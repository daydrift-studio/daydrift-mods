import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packDeterministicZip } from "./pack-zip.mjs";
import { signMod } from "./lib/signing.mjs";
import { buildModIndex } from "./build-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let inputPath = "";
  let keyPath = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) {
      keyPath = args[++i];
    } else if (!inputPath && !args[i].startsWith("--")) {
      inputPath = args[i];
    }
  }

  if (!inputPath) {
    console.error("Usage: node tools/import-submission.mjs <mod_folder_or_zip> [--key <key_path>]");
    process.exit(1);
  }

  return { inputPath, keyPath };
}

function compareVersions(v1, v2) {
  const parse = (v) => v.split(".").map((n) => parseInt(n.replace(/\D/g, ""), 10) || 0);
  const p1 = parse(v1);
  const p2 = parse(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function main() {
  const { inputPath, keyPath } = parseArgs();
  const absInput = path.resolve(inputPath);

  if (!fs.existsSync(absInput)) {
    console.error(`[ERROR] Input file or directory not found: ${absInput}`);
    process.exit(1);
  }

  let modSourceDir = absInput;

  // If input is a directory, inspect directly
  const isDir = fs.statSync(absInput).isDirectory();
  if (!isDir) {
    console.error("[ERROR] For ZIP archives, please unzip to a temporary folder first or pass an extracted folder path.");
    process.exit(1);
  }

  const manifestPath = path.join(modSourceDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] manifest.json not found in ${modSourceDir}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const modId = manifest.id;
  const newVersion = manifest.version || "1.0.0";

  if (!modId || typeof modId !== "string" || !/^[a-z0-9_]+$/.test(modId)) {
    console.error(`[ERROR] Invalid mod ID '${modId}'. Must consist of lowercase letters, digits, and underscores only.`);
    process.exit(1);
  }

  // Determine target directory
  const communityModsDir = path.join(ROOT_DIR, "mods", "community");
  fs.mkdirSync(communityModsDir, { recursive: true });
  const targetDir = path.join(communityModsDir, modId);

  let isUpdate = false;
  if (fs.existsSync(targetDir)) {
    const existingManifestPath = path.join(targetDir, "manifest.json");
    if (fs.existsSync(existingManifestPath)) {
      const oldManifest = JSON.parse(fs.readFileSync(existingManifestPath, "utf-8"));
      const oldVersion = oldManifest.version || "0.0.0";
      if (compareVersions(newVersion, oldVersion) <= 0) {
        console.warn(`[WARN] New version '${newVersion}' is not greater than existing version '${oldVersion}'. Overwrite proceeding.`);
      } else {
        console.log(`[UPDATE] Upgrading mod '${modId}' from v${oldVersion} -> v${newVersion}`);
      }
      isUpdate = true;
    }
  }

  if (!isUpdate) {
    console.log(`[NEW] Registering new community mod '${modId}' (v${newVersion})`);
  }

  // Copy files to target
  copyDirRecursive(modSourceDir, targetDir);

  // Pack deterministic zip
  const downloadsDir = path.join(ROOT_DIR, "downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });
  const zipName = `${modId}-${newVersion}.zip`;
  const outZipPath = path.join(downloadsDir, zipName);
  console.log(`[PACK] Building deterministic ZIP: ${zipName}`);
  const packResult = packDeterministicZip(targetDir, outZipPath);
  console.log(`  -> Size: ${packResult.size} bytes, SHA-256: ${packResult.sha256}`);

  // Sign mod
  console.log(`[SIGN] Signing mod '${modId}'...`);
  let keyData = null;
  const defaultKeyPath = path.join(ROOT_DIR, "keys", "official-offline-v1.private.key.json");
  const actualKeyPath = keyPath ? path.resolve(keyPath) : defaultKeyPath;

  if (fs.existsSync(actualKeyPath)) {
    keyData = JSON.parse(fs.readFileSync(actualKeyPath, "utf-8"));
  }

  const signResult = signMod(targetDir, {
    key: keyData,
    keyId: keyData?.id || "official-offline-v1",
    signedAt: new Date().toISOString()
  });

  const sigPath = path.join(targetDir, "signature.json");
  fs.writeFileSync(sigPath, JSON.stringify(signResult.signatureDoc, null, 2) + "\n", "utf-8");
  console.log(`  -> Signed successfully! Signature digest: ${signResult.digest}`);

  // Rebuild index
  console.log(`[INDEX] Rebuilding registry index.json and catalog.json...`);
  buildModIndex(ROOT_DIR);

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] Mod '${modId}' v${newVersion} imported, signed, and indexed!`);
  console.log(`To publish to Cloudflare Pages & game workshop, run:`);
  console.log(`  git add -A`);
  console.log(`  git commit -m "feat(mod): ${isUpdate ? 'update' : 'add'} ${modId} v${newVersion}"`);
  console.log(`  git push origin main`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
