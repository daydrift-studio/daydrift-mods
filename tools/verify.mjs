import fs from "node:fs";
import path from "node:path";
import { verifyMod, collectSignedFiles } from "./lib/signing.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  let modDir = "";
  let trustedKeysPath = "keys/trusted-keys.json";
  let revokedPath = "keys/revoked-mods.json";
  let expectedChannel = null;
  let strict = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--trusted-keys" && args[i + 1]) {
      trustedKeysPath = args[++i];
    } else if (args[i] === "--revoked" && args[i + 1]) {
      revokedPath = args[++i];
    } else if (args[i] === "--expected-channel" && args[i + 1]) {
      expectedChannel = args[++i];
    } else if (args[i] === "--strict") {
      strict = true;
    } else if (args[i] === "--list") {
      list = true;
    } else if (!modDir && !args[i].startsWith("--")) {
      modDir = args[i];
    }
  }

  if (!modDir) {
    console.error("Usage: node tools/verify.mjs <modDir> [--trusted-keys <path>] [--revoked <path>] [--expected-channel release|beta] [--strict] [--list]");
    process.exit(1);
  }

  return { modDir, trustedKeysPath, revokedPath, expectedChannel, strict, list };
}

async function main() {
  const opts = parseArgs();
  const absModDir = path.resolve(opts.modDir);

  if (opts.list) {
    const { files, lines, digest } = collectSignedFiles(absModDir);
    process.stdout.write(lines);
    console.log(`Digest: ${digest} (${files.length} files)`);
    return;
  }

  let trustedKeys = { keys: [] };
  if (fs.existsSync(opts.trustedKeysPath)) {
    trustedKeys = JSON.parse(fs.readFileSync(opts.trustedKeysPath, "utf-8"));
  }

  let revokedDigests = [];
  if (fs.existsSync(opts.revokedPath)) {
    const revData = JSON.parse(fs.readFileSync(opts.revokedPath, "utf-8"));
    revokedDigests = revData.revokedDigests || [];
  }

  // Infer expectedChannel from directory name if not explicitly set
  let expectedChannel = opts.expectedChannel;
  if (!expectedChannel) {
    const norm = absModDir.replace(/\\/g, "/");
    if (norm.includes("/mods/beta/")) {
      expectedChannel = "beta";
    } else if (norm.includes("/mods/official/") || norm.includes("/mods/community/")) {
      expectedChannel = "release";
    }
  }

  const result = verifyMod(absModDir, trustedKeys, {
    expectedChannel,
    revokedDigests
  });

  if (result.status === "verified") {
    console.log(`[OK] Mod verified (Release channel): ${result.keyId}`);
    console.log(`Digest: ${result.digest} (${result.filesCount} files)`);
    process.exit(0);
  } else if (result.status === "beta") {
    if (opts.strict) {
      console.error(`[FAIL] Mod is in beta channel, strict mode requires verified release key`);
      process.exit(1);
    }
    console.log(`[OK] Mod verified (Beta channel): ${result.keyId}`);
    console.log(`Digest: ${result.digest} (${result.filesCount} files)`);
    process.exit(0);
  } else if (result.status === "unsigned") {
    if (opts.strict) {
      console.error(`[FAIL] Mod is unsigned (strict mode)`);
      process.exit(1);
    }
    console.log(`[WARN] Mod is unsigned`);
    process.exit(0);
  } else {
    console.error(`[FAIL] Mod verification failed: reason=${result.reason} (${result.message})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[ERROR] Verification crashed:`, err);
  process.exit(1);
});
