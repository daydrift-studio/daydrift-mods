import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    keyId: "",
    channel: "release",
    label: "",
    outDir: "."
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key-id" && args[i + 1]) {
      opts.keyId = args[++i];
    } else if (args[i] === "--channel" && args[i + 1]) {
      opts.channel = args[++i];
    } else if (args[i] === "--label" && args[i + 1]) {
      opts.label = args[++i];
    } else if (args[i] === "--out" && args[i + 1]) {
      opts.outDir = args[++i];
    }
  }

  if (!opts.keyId) {
    console.error("Usage: node tools/keygen.mjs --key-id <key-id> [--channel release|beta] [--label <label>] [--out <dir>]");
    process.exit(1);
  }

  if (!opts.label) {
    opts.label = `Daydrift ${opts.channel} (${opts.keyId})`;
  }

  return opts;
}

export function generateEd25519Key(keyId, channel = "release", label = "") {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const pubJwk = publicKey.export({ format: "jwk" });
  const privJwk = privateKey.export({ format: "jwk" });

  const today = new Date().toISOString().slice(0, 10);

  const keyRecord = {
    keyId,
    label: label || `Daydrift ${channel} key`,
    channel,
    publicKey: {
      kty: "OKP",
      crv: "Ed25519",
      x: pubJwk.x
    },
    revoked: false,
    createdAt: today
  };

  const secretRecord = {
    ...keyRecord,
    privateKey: {
      kty: "OKP",
      crv: "Ed25519",
      d: privJwk.d,
      x: pubJwk.x
    }
  };

  return { keyRecord, secretRecord };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const opts = parseArgs();
  const { keyRecord, secretRecord } = generateEd25519Key(opts.keyId, opts.channel, opts.label);

  const outDir = path.resolve(opts.outDir);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const privPath = path.join(outDir, `${opts.keyId}.key.json`);
  fs.writeFileSync(privPath, JSON.stringify(secretRecord, null, 2) + "\n", { mode: 0o600 });
  console.log(`[OK] Generated private key: ${privPath}`);
  console.log(`\nPublic key record for trusted-keys.json:`);
  console.log(JSON.stringify(keyRecord, null, 2));
}
