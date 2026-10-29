import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { normalizeRelPath, isTextFile } from "./lib/signing.mjs";

const DOS_TIME = 0x0000; // 00:00:00
const DOS_DATE = 0x0021; // 1980-01-01

export function packDeterministicZip(modDir, outZipPath) {
  const absModDir = path.resolve(modDir);
  const manifestPath = path.join(absModDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${modDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const modId = manifest.id;

  // Collect all files to include
  const entries = [];

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      const rawRel = path.relative(absModDir, fullPath);
      const relPath = normalizeRelPath(rawRel);

      if (item.name === ".git" || item.name === ".github" || item.name === "node_modules" || item.name === ".vscode" || item.name === ".idea") {
        continue;
      }
      if (item.name === ".DS_Store" || item.name === "Thumbs.db" || item.name === "desktop.ini") {
        continue;
      }
      if (item.name.endsWith(".zip")) {
        continue;
      }

      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile()) {
        // Zip internal entry path: <modId>/<relPath>
        const entryName = `${modId}/${relPath}`;
        entries.push({
          entryName,
          fullPath,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }

  walk(absModDir);

  // Strictly sort entries ascending by UTF-8 byte order of entryName
  entries.sort((a, b) => {
    const bufA = Buffer.from(a.entryName, "utf-8");
    const bufB = Buffer.from(b.entryName, "utf-8");
    return Buffer.compare(bufA, bufB);
  });

  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const entry of entries) {
    let fileData = fs.readFileSync(entry.fullPath);
    if (isTextFile(entry.entryName) && fileData.includes(0x0d)) {
      fileData = Buffer.from(fileData.toString("utf-8").replace(/\r\n/g, "\n"), "utf-8");
    }
    const uncompressedSize = fileData.length;
    const crc = zlib.crc32(fileData);

    // Deflate with fixed compression level 9
    const compressedData = zlib.deflateRawSync(fileData, { level: 9 });
    const compressedSize = compressedData.length;

    const nameBuf = Buffer.from(entry.entryName, "utf-8");

    // Local header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // Deflate
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    const localChunk = Buffer.concat([localHeader, nameBuf, compressedData]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(0x0314, 4); // Unix + 2.0
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename
    centralHeader.writeUInt16LE(8, 10); // Deflate
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal file attr
    // Unix 0644 file permissions
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(currentOffset, 42); // local header offset

    const centralChunk = Buffer.concat([centralHeader, nameBuf]);
    centralHeaders.push(centralChunk);

    currentOffset += localChunk.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = currentOffset;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // disk CD start
  eocd.writeUInt16LE(entries.length, 8); // entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  const fullZipBuffer = Buffer.concat([...localHeaders, centralDirBuffer, eocd]);

  if (outZipPath) {
    const absOut = path.resolve(outZipPath);
    const parentDir = path.dirname(absOut);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(absOut, fullZipBuffer);
  }

  const sha256 = crypto.createHash("sha256").update(fullZipBuffer).digest("hex");

  return {
    buffer: fullZipBuffer,
    size: fullZipBuffer.length,
    sha256: `sha256:${sha256}`,
    entriesCount: entries.length
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const modDir = process.argv[2];
  const outZip = process.argv[3];
  if (!modDir || !outZip) {
    console.error("Usage: node tools/pack-zip.mjs <modDir> <outZipPath>");
    process.exit(1);
  }
  const result = packDeterministicZip(modDir, outZip);
  console.log(`[OK] Packed ${result.entriesCount} entries into ${outZip}`);
  console.log(`Size: ${result.size} bytes`);
  console.log(`SHA-256: ${result.sha256}`);
}
