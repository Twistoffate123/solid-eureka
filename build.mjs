#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
process.env.VITE_AUTH_ENABLED ??= "false";

try {
  const envFile = join(root, ".grok", "app-env.json");
  if (existsSync(envFile)) {
    const parsed = JSON.parse(readFileSync(envFile, "utf8"));
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith("VITE_") && typeof value === "string") {
          process.env[key] ??= value;
        }
      }
    }
  }
} catch {
  // Deploy hosts often omit .grok; auth stays off.
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run("vite", ["build"]);
if (existsSync(join(root, "scripts", "migrate.mjs"))) {
  await run("node", [join(root, "scripts", "migrate.mjs")]);
}
