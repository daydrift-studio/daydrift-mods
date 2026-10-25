import fs from "node:fs";
import path from "node:path";
import { verifyMod } from "./lib/signing.mjs";
import { packDeterministicZip } from "./pack-zip.mjs";

const SITE_ORIGIN = process.env.MODS_SITE_ORIGIN || "https://mods.daydrift.example";

export function buildIndex(rootDir = ".", options = {}) {
  const absRoot = path.resolve(rootDir);
  const keysPath = path.join(absRoot, "keys/trusted-keys.json");
  const revokedPath = path.join(absRoot, "keys/revoked-mods.json");

  const trustedKeys = fs.existsSync(keysPath)
    ? JSON.parse(fs.readFileSync(keysPath, "utf-8"))
    : { keys: [] };

  const revokedData = fs.existsSync(revokedPath)
    ? JSON.parse(fs.readFileSync(revokedPath, "utf-8"))
    : { revokedDigests: [] };

  const revokedDigests = revokedData.revokedDigests || [];

  const downloadsDir = path.join(absRoot, "downloads");
  const previewsDir = path.join(absRoot, "previews");
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
  if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });

  const origins = [
    { dir: "mods/official", origin: "official", defaultChannel: "release" },
    { dir: "mods/community", origin: "community", defaultChannel: "release" },
    { dir: "mods/beta", origin: "beta", defaultChannel: "beta" }
  ];

  const indexedMods = [];
  const catalogMods = [];

  for (const { dir, origin, defaultChannel } of origins) {
    const originAbs = path.join(absRoot, dir);
    if (!fs.existsSync(originAbs)) continue;

    const entries = fs.readdirSync(originAbs, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const modDir = path.join(originAbs, ent.name);
      const manifestPath = path.join(modDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) continue;

      const verification = verifyMod(modDir, trustedKeys, {
        expectedChannel: defaultChannel,
        revokedDigests
      });

      if (verification.status !== "verified" && verification.status !== "beta") {
        if (options.strict) {
          throw new Error(`Mod verification failed for ${dir}/${ent.name}: ${verification.reason} (${verification.message})`);
        }
        console.warn(`[WARN] Skipping invalid/unverified mod ${dir}/${ent.name}: ${verification.reason}`);
        continue;
      }

      const manifest = verification.manifest;
      const modId = manifest.id;
      const modVersion = manifest.version;

      // Pack deterministic zip
      const zipFileName = `${modId}-${modVersion}.zip`;
      const zipOutPath = path.join(downloadsDir, zipFileName);
      const zipResult = packDeterministicZip(modDir, zipOutPath);

      // Handle preview image if declared
      let previewRelativePath = null;
      let previewAbsUrl = null;
      if (manifest.preview) {
        const previewSrc = path.join(modDir, manifest.preview);
        if (fs.existsSync(previewSrc)) {
          const ext = path.extname(manifest.preview);
          const previewDestName = `${modId}-${modVersion}${ext}`;
          const previewDestPath = path.join(previewsDir, previewDestName);
          fs.copyFileSync(previewSrc, previewDestPath);
          previewRelativePath = `previews/${previewDestName}`;
          previewAbsUrl = `${SITE_ORIGIN}/previews/${previewDestName}`;
        }
      }

      const relPath = path.relative(absRoot, modDir).replace(/\\/g, "/");

      const modIndexRecord = {
        id: modId,
        name: manifest.name,
        version: modVersion,
        author: manifest.author || "Unknown",
        description: manifest.description || "",
        origin,
        channel: verification.channel,
        path: relPath,
        digest: verification.digest,
        keyId: verification.keyId,
        signedAt: verification.manifest?.signedAt || new Date().toISOString(),
        preview: previewRelativePath,
        permissions: manifest.permissions || [],
        type: manifest.type || "data",
        netSyncMode: manifest.net_sync_mode || "client_only",
        compatibility: manifest.compatibility || { minVersionCode: 0, maxVersionCode: null },
        size: zipResult.size,
        download: `downloads/${zipFileName}`,
        sha256: zipResult.sha256,
        source: manifest.source || null,
        sourceCommit: manifest.sourceCommit || null,
        owners: manifest.owners || (origin === "official" ? ["daydrift-studio"] : []),
        license: manifest.license || "CC-BY-4.0"
      };

      const modCatalogRecord = {
        id: modId,
        name: manifest.name,
        version: modVersion,
        author: manifest.author || "Unknown",
        description: manifest.description || "",
        origin,
        channel: verification.channel,
        type: manifest.type || "data",
        netSyncMode: manifest.net_sync_mode || "client_only",
        permissions: manifest.permissions || [],
        compatibility: manifest.compatibility || { minVersionCode: 0, maxVersionCode: null },
        digest: verification.digest,
        keyId: verification.keyId,
        signedAt: verification.manifest?.signedAt || new Date().toISOString(),
        size: zipResult.size,
        sha256: zipResult.sha256,
        downloadUrl: `${SITE_ORIGIN}/downloads/${zipFileName}`,
        previewUrl: previewAbsUrl,
        source: manifest.source || null,
        sourceCommit: manifest.sourceCommit || null,
        license: manifest.license || "CC-BY-4.0"
      };

      indexedMods.push(modIndexRecord);
      catalogMods.push(modCatalogRecord);
    }
  }

  // Sort mods by id and version
  indexedMods.sort((a, b) => a.id.localeCompare(b.id));
  catalogMods.sort((a, b) => a.id.localeCompare(b.id));

  const now = new Date().toISOString();

  const indexDoc = {
    format: "daydrift-mod-index",
    version: 1,
    generatedAt: now,
    mods: indexedMods
  };

  const catalogDoc = {
    format: "daydrift-mod-catalog",
    version: 1,
    generatedAt: now,
    site: SITE_ORIGIN,
    mods: catalogMods
  };

  const indexPath = path.join(absRoot, "index.json");
  const catalogPath = path.join(absRoot, "catalog.json");

  fs.writeFileSync(indexPath, JSON.stringify(indexDoc, null, 2) + "\n", "utf-8");
  fs.writeFileSync(catalogPath, JSON.stringify(catalogDoc, null, 2) + "\n", "utf-8");

  // Sync to apps/store/public if present
  const storePublic = path.join(absRoot, "apps/store/public");
  if (fs.existsSync(storePublic)) {
    fs.copyFileSync(catalogPath, path.join(storePublic, "catalog.json"));

    const storeDownloads = path.join(storePublic, "downloads");
    const storePreviews = path.join(storePublic, "previews");
    if (!fs.existsSync(storeDownloads)) fs.mkdirSync(storeDownloads, { recursive: true });
    if (!fs.existsSync(storePreviews)) fs.mkdirSync(storePreviews, { recursive: true });

    for (const f of fs.readdirSync(downloadsDir)) {
      fs.copyFileSync(path.join(downloadsDir, f), path.join(storeDownloads, f));
    }
    for (const f of fs.readdirSync(previewsDir)) {
      fs.copyFileSync(path.join(previewsDir, f), path.join(storePreviews, f));
    }
  }

  return { indexDoc, catalogDoc, count: indexedMods.length };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const isStrict = process.argv.includes("--strict");
  const result = buildIndex(".", { strict: isStrict });
  console.log(`[OK] Built index.json and catalog.json with ${result.count} verified mod(s).`);
}
