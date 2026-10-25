import fs from "node:fs";
import path from "node:path";
import { signMod } from "./lib/signing.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  let modDir = "";
  let keyPath = "";
  let keyId = "";
  let signedAt = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) {
      keyPath = args[++i];
    } else if (args[i] === "--key-id" && args[i + 1]) {
      keyId = args[++i];
    } else if (args[i] === "--signed-at" && args[i + 1]) {
      signedAt = args[++i];
    } else if (!modDir && !args[i].startsWith("--")) {
      modDir = args[i];
    }
  }

  if (!modDir) {
    console.error("Usage: node tools/sign.mjs <modDir> [--key <key.json>] [--key-id <id>] [--signed-at <iso>]");
    process.exit(1);
  }

  return { modDir, keyPath, keyId, signedAt };
}

async function main() {
  const opts = parseArgs();
  const absModDir = path.resolve(opts.modDir);

  let keyData = null;
  if (opts.keyPath) {
    keyData = JSON.parse(fs.readFileSync(opts.keyPath, "utf-8"));
  } else if (process.env.DAYDRIFT_SIGNING_KEY_JSON) {
    keyData = JSON.parse(process.env.DAYDRIFT_SIGNING_KEY_JSON);
  } else {
    // Look in keys/ directory for matching key
    const keysDir = path.resolve("keys");
    if (fs.existsSync(keysDir)) {
      const files = fs.readdirSync(keysDir).filter((f) => f.endsWith(".key.json"));
      if (files.length > 0) {
        keyData = JSON.parse(fs.readFileSync(path.join(keysDir, files[0]), "utf-8"));
      }
    }
  }

  if (!keyData) {
    console.error("[ERROR] No signing key provided via --key, DAYDRIFT_SIGNING_KEY_JSON, or keys/*.key.json");
    process.exit(1);
  }

  const result = signMod(absModDir, keyData, {
    keyId: opts.keyId || keyData.keyId,
    signedAt: opts.signedAt,
    write: true
  });

  console.log(`[OK] Mod successfully signed: ${result.sigRecord.modId} v${result.sigRecord.modVersion}`);
  console.log(`Key ID:    ${result.sigRecord.keyId}`);
  console.log(`Signed At: ${result.sigRecord.signedAt}`);
  console.log(`Digest:    ${result.sigRecord.digest}`);
  console.log(`Signature: ${result.sigRecord.signature}`);
  console.log(`Covered:   ${result.files.length} files`);
}

main().catch((err) => {
  console.error(`[ERROR] Signing failed:`, err);
  process.exit(1);
});
