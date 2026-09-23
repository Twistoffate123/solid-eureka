import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function readIcon(name) {
  const direct = join(here, "icons", name);
  if (existsSync(direct)) {
    const text = readFileSync(direct, "utf8").trim();
    if (text.startsWith("iVBOR")) return text;
  }
  const stem = name.replace(/\.b64$/, "");
  let out = "";
  for (let i = 0; i < 8; i++) {
    const part = join(here, "icons", `${stem}.part${i}`);
    if (!existsSync(part)) break;
    out += readFileSync(part, "utf8").trim();
  }
  return out.startsWith("iVBOR") ? out : "";
}

for (const [rel, name] of Object.entries(files)) {
  const b64 = readIcon(name);
  if (!b64) continue;
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(b64, "base64"));
}
