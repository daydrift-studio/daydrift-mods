import fs from "node:fs";
import path from "node:path";
import { verifyMod } from "./lib/signing.mjs";

const rootDir = path.resolve(".");
const keysPath = path.join(rootDir, "keys/trusted-keys.json");
const revokedPath = path.join(rootDir, "keys/revoked-mods.json");

if (!fs.existsSync(keysPath)) {
  console.error("[ERROR] trusted-keys.json missing, aborting build.");
  process.exit(1);
}

const trustedKeys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
const revokedData = fs.existsSync(revokedPath)
  ? JSON.parse(fs.readFileSync(revokedPath, "utf-8"))
  : { revokedDigests: [] };
const revokedDigests = revokedData.revokedDigests || [];

const origins = [
  { dir: "mods/official", expectedChannel: "release" },
  { dir: "mods/community", expectedChannel: "release" },
  { dir: "mods/beta", expectedChannel: "beta" }
];

let failed = false;
let count = 0;

for (const { dir, expectedChannel } of origins) {
  const absDir = path.join(rootDir, dir);
  if (!fs.existsSync(absDir)) continue;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const modDir = path.join(absDir, ent.name);
    if (!fs.existsSync(path.join(modDir, "manifest.json"))) continue;

    count++;
    const res = verifyMod(modDir, trustedKeys, {
      expectedChannel,
      revokedDigests
    });

    if (res.status !== "verified" && res.status !== "beta") {
      console.error(`[FAIL] Verification rejected for ${dir}/${ent.name}: reason=${res.reason} (${res.message})`);
      failed = true;
    } else {
      console.log(`[PASS] ${dir}/${ent.name} (${res.status}, ${res.keyId})`);
    }
  }
}

if (failed) {
  console.error(`\n[ABORT] One or more mods failed verification. Build canceled to keep previous deployment intact.`);
  process.exit(1);
}

console.log(`\n[OK] All ${count} mod(s) verified successfully. Safe to proceed with site build.`);
process.exit(0);
