import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { packDeterministicZip } from "../tools/pack-zip.mjs";
import { signMod, verifyMod } from "../tools/lib/signing.mjs";

const vectorPath = path.resolve("test/vectors/signing.json");
const vector = JSON.parse(fs.readFileSync(vectorPath, "utf-8"));

test("Deterministic Zip Packaging", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "daydrift-zip-test-"));
  try {
    const modDir = path.join(tempDir, "mod");
    fs.mkdirSync(modDir);
    fs.mkdirSync(path.join(modDir, "data"));

    fs.writeFileSync(
      path.join(modDir, "manifest.json"),
      JSON.stringify({ id: "zip_mod", name: "Zip Mod", version: "1.0.0", type: "data" }, null, 2)
    );
    fs.writeFileSync(path.join(modDir, "data/file1.txt"), "Hello deterministic zip\n");
    fs.writeFileSync(path.join(modDir, "data/file2.txt"), "Another line of text\n");

    signMod(modDir, vector.testKey, { signedAt: vector.signedAt, write: true });

    // Pack 1
    const zip1Path = path.join(tempDir, "out1.zip");
    const res1 = packDeterministicZip(modDir, zip1Path);

    // Pack 2 (different time, different path)
    const zip2Path = path.join(tempDir, "out2.zip");
    const res2 = packDeterministicZip(modDir, zip2Path);

    assert.equal(res1.sha256, res2.sha256, "Deterministic zip produces identical SHA-256");
    assert.equal(res1.size, res2.size, "Zip sizes match exactly");

    const buf1 = fs.readFileSync(zip1Path);
    const buf2 = fs.readFileSync(zip2Path);
    assert.ok(buf1.equals(buf2), "Binary content of two zip runs is identical");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
