import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, "../apps/store/dist");
const dst = path.resolve(__dirname, "../dist");

if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`[OK] Successfully synchronized build output: ${src} -> ${dst}`);
} else {
  console.warn(`[WARN] Source directory not found: ${src}`);
}
