import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_FILES = 4000;
export const MAX_TOTAL_BYTES = 128 * 1024 * 1024; // 128 MiB

const MOD_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MOD_VERSION_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const KEY_ID_REGEX = /^[a-z0-9][a-z0-9.-]{0,63}$/;

export function normalizeRelPath(p) {
  // Unicode NFC normalization
  let norm = p.normalize("NFC");
  // Force forward slashes
  norm = norm.replace(/\\/g, "/");
  return norm;
}

export function validatePathSecurity(relPath) {
  if (path.isAbsolute(relPath) || relPath.startsWith("/")) {
    throw new Error(`Absolute path not allowed: ${relPath}`);
  }
  const segments = relPath.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg === "") {
      throw new Error(`Invalid path segment '${seg}' in: ${relPath}`);
    }
  }
}

export function collectSignedFiles(modDir) {
  const absModDir = path.resolve(modDir);
  if (!fs.existsSync(absModDir) || !fs.statSync(absModDir).isDirectory()) {
    throw new Error(`Directory not found: ${modDir}`);
  }

  const collected = [];
  const lowercaseSet = new Set();
  const nfcSet = new Set();
  let totalBytes = 0;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(currentDir, ent.name);
      const rawRel = path.relative(absModDir, fullPath);
      const relPath = normalizeRelPath(rawRel);

      // Check for symlinks or special file types
      if (ent.isSymbolicLink() || ent.isFIFO?.() || ent.isSocket?.() || ent.isCharacterDevice?.() || ent.isBlockDevice?.()) {
        const err = new Error(`Unsafe file type detected: ${relPath}`);
        err.code = "unsafe-tree";
        throw err;
      }

      if (ent.isDirectory()) {
        walk(fullPath);
      } else if (ent.isFile()) {
        // Exclude root daydrift.sig.json
        if (relPath === "daydrift.sig.json") {
          continue;
        }

        // Exclude system files in any directory
        const basename = path.basename(relPath);
        if (basename === ".DS_Store" || basename === "Thumbs.db" || basename === "desktop.ini") {
          continue;
        }

        validatePathSecurity(relPath);

        // Check NFC and lowercase collisions
        const lower = relPath.toLowerCase();
        if (lowercaseSet.has(lower)) {
          const err = new Error(`Case collision detected: ${relPath}`);
          err.code = "unsafe-tree";
          throw err;
        }
        lowercaseSet.add(lower);

        if (nfcSet.has(relPath)) {
          const err = new Error(`Duplicate path detected: ${relPath}`);
          err.code = "unsafe-tree";
          throw err;
        }
        nfcSet.add(relPath);

        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;

        if (totalBytes > MAX_TOTAL_BYTES) {
          const err = new Error(`Total size exceeds limit: ${totalBytes} > ${MAX_TOTAL_BYTES}`);
          err.code = "unsafe-tree";
          throw err;
        }

        if (collected.length >= MAX_FILES) {
          const err = new Error(`Total files exceed limit: ${collected.length} >= ${MAX_FILES}`);
          err.code = "unsafe-tree";
          throw err;
        }

        const buf = fs.readFileSync(fullPath);
        const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

        collected.push({
          relPath,
          sha256,
          size: stat.size,
          absPath: fullPath
        });
      }
    }
  }

  walk(absModDir);

  // Sort ascending by UTF-8 byte order
  collected.sort((a, b) => {
    const bufA = Buffer.from(a.relPath, "utf-8");
    const bufB = Buffer.from(b.relPath, "utf-8");
    return Buffer.compare(bufA, bufB);
  });

  const { lines, digest } = computeSignedDigest(collected);

  return {
    files: collected,
    lines,
    digest
  };
}

export function computeSignedDigest(files) {
  // Line format: <64-hex><space><relPath>\n
  let lines = "";
  for (const f of files) {
    lines += `${f.sha256} ${f.relPath}\n`;
  }

  const digestHex = crypto.createHash("sha256").update(Buffer.from(lines, "utf-8")).digest("hex");
  const digest = `sha256:${digestHex}`;

  return { lines, digest };
}

export function buildSignedMessage(modId, modVersion, digest, keyId, signedAt) {
  if (!MOD_ID_REGEX.test(modId)) {
    throw new Error(`Invalid modId: '${modId}'`);
  }
  if (!MOD_VERSION_REGEX.test(modVersion)) {
    throw new Error(`Invalid modVersion: '${modVersion}'`);
  }
  if (!KEY_ID_REGEX.test(keyId)) {
    throw new Error(`Invalid keyId: '${keyId}'`);
  }

  // Ensure raw 64-hex format for digest line
  const rawDigest = digest.startsWith("sha256:") ? digest.slice(7) : digest;
  if (!/^[0-9a-f]{64}$/.test(rawDigest)) {
    throw new Error(`Invalid digest hex format: '${rawDigest}'`);
  }

  // Signed message format (6 lines + trailing empty line = trailing LF)
  const message =
    `daydrift-signature/1\n` +
    `modId=${modId}\n` +
    `modVersion=${modVersion}\n` +
    `digest=sha256:${rawDigest}\n` +
    `keyId=${keyId}\n` +
    `signedAt=${signedAt}\n\n`;

  return message;
}

export function signMod(modDir, privateKeyJwk, options = {}) {
  const absModDir = path.resolve(modDir);
  const manifestPath = path.join(absModDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${modDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const modId = manifest.id;
  const modVersion = manifest.version;

  const { files, lines, digest } = collectSignedFiles(absModDir);

  const keyId = privateKeyJwk.keyId || options.keyId;
  if (!keyId) {
    throw new Error("Missing keyId for signing");
  }

  const signedAt = options.signedAt || new Date().toISOString();
  const message = buildSignedMessage(modId, modVersion, digest, keyId, signedAt);

  // Import Ed25519 private key from JWK
  const privKeyObj = crypto.createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: privateKeyJwk.privateKey?.d || privateKeyJwk.d,
      x: privateKeyJwk.publicKey?.x || privateKeyJwk.x
    },
    format: "jwk"
  });

  const sigBuffer = crypto.sign(null, Buffer.from(message, "utf-8"), privKeyObj);
  const signature = sigBuffer.toString("base64");

  const sigRecord = {
    format: "daydrift-signature",
    version: 1,
    modId,
    modVersion,
    digest,
    keyId,
    signedAt,
    signature
  };

  if (options.write !== false) {
    const sigPath = path.join(absModDir, "daydrift.sig.json");
    fs.writeFileSync(sigPath, JSON.stringify(sigRecord, null, 2) + "\n", "utf-8");
  }

  return {
    sigRecord,
    message,
    lines,
    digest,
    files
  };
}

export function verifyMod(modDir, trustedKeys, options = {}) {
  const absModDir = path.resolve(modDir);
  const manifestPath = path.join(absModDir, "manifest.json");
  const sigPath = path.join(absModDir, "daydrift.sig.json");

  // Check manifest
  if (!fs.existsSync(manifestPath)) {
    return { status: "invalid", reason: "malformed", message: "manifest.json missing" };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    return { status: "invalid", reason: "malformed", message: "manifest.json invalid JSON" };
  }

  // Check signature file
  if (!fs.existsSync(sigPath)) {
    return { status: "unsigned", message: "daydrift.sig.json not found" };
  }

  let sigRecord;
  try {
    sigRecord = JSON.parse(fs.readFileSync(sigPath, "utf-8"));
  } catch (e) {
    return { status: "invalid", reason: "malformed", message: "daydrift.sig.json invalid JSON" };
  }

  if (sigRecord.format !== "daydrift-signature" || sigRecord.version !== 1) {
    return { status: "invalid", reason: "malformed", message: "Unsupported format or version" };
  }

  if (sigRecord.modId !== manifest.id || sigRecord.modVersion !== manifest.version) {
    return { status: "invalid", reason: "mod-mismatch", message: "ID or version in signature does not match manifest" };
  }

  // Find trusted key
  const keyList = Array.isArray(trustedKeys) ? trustedKeys : trustedKeys?.keys || [];
  const keyEntry = keyList.find((k) => k.keyId === sigRecord.keyId);

  if (!keyEntry) {
    return { status: "invalid", reason: "unknown-key", message: `Key ${sigRecord.keyId} not in trusted list` };
  }

  if (keyEntry.revoked) {
    return { status: "invalid", reason: "revoked-key", message: `Key ${sigRecord.keyId} has been revoked` };
  }

  // Collect files and verify tree
  let collected;
  try {
    collected = collectSignedFiles(absModDir);
  } catch (err) {
    if (err.code === "unsafe-tree") {
      return { status: "invalid", reason: "unsafe-tree", message: err.message };
    }
    return { status: "invalid", reason: "malformed", message: err.message };
  }

  // Check digest
  if (collected.digest !== sigRecord.digest) {
    return {
      status: "invalid",
      reason: "digest-mismatch",
      message: `Digest mismatch: expected ${sigRecord.digest}, got ${collected.digest}`
    };
  }

  // Check revoked digest
  const revokedDigests = options.revokedDigests || [];
  if (revokedDigests.includes(sigRecord.digest)) {
    return { status: "invalid", reason: "revoked-mod", message: `Mod digest ${sigRecord.digest} is revoked` };
  }

  // Verify Ed25519 signature
  let message;
  try {
    message = buildSignedMessage(sigRecord.modId, sigRecord.modVersion, sigRecord.digest, sigRecord.keyId, sigRecord.signedAt);
  } catch (err) {
    return { status: "invalid", reason: "malformed", message: err.message };
  }

  const pubKeyObj = crypto.createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: keyEntry.publicKey.x
    },
    format: "jwk"
  });

  const sigBuf = Buffer.from(sigRecord.signature, "base64");
  const isVerified = crypto.verify(null, Buffer.from(message, "utf-8"), pubKeyObj, sigBuf);

  if (!isVerified) {
    return { status: "invalid", reason: "bad-signature", message: "Ed25519 signature verification failed" };
  }

  // Verify channel
  const keyChannel = keyEntry.channel || "release";
  if (options.expectedChannel && keyChannel !== options.expectedChannel) {
    return {
      status: "invalid",
      reason: "wrong-channel",
      message: `Expected channel '${options.expectedChannel}', but key is for '${keyChannel}'`
    };
  }

  return {
    status: keyChannel === "beta" ? "beta" : "verified",
    keyId: keyEntry.keyId,
    channel: keyChannel,
    digest: sigRecord.digest,
    filesCount: collected.files.length,
    manifest
  };
}

export function keyChannelOf(keyId, trustedKeys) {
  const keyList = Array.isArray(trustedKeys) ? trustedKeys : trustedKeys?.keys || [];
  const entry = keyList.find((k) => k.keyId === keyId);
  return entry ? entry.channel || "release" : null;
}
