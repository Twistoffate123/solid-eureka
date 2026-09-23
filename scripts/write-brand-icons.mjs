import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const files = {
  "public/__grok/icon-180.png": "icon-180.b64",
  "public/icon-192.png": "icon-192.b64",
  "public/icon-512.png": "icon-512.b64",
  "public/icon-512-maskable.png": "icon-512-maskable.b64",
};

for (const [rel, name] of Object.entries(files)) {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const b64 = readFileSync(join(here, "icons", name), "utf8").trim();
  writeFileSync(dest, Buffer.from(b64, "base64"));
}
