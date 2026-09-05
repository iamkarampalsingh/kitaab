#!/usr/bin/env node
/**
 * Coolify / Docker start: apply SQL, then serve the Nitro node build.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, ".output/server/index.mjs");

if (!existsSync(server)) {
  console.error("[kitaab] missing .output/server/index.mjs — build with NITRO_PRESET=node-server");
  process.exit(1);
}

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited ${code}`));
    });
    child.on("error", reject);
  });
}

try {
  await run(join(root, "scripts/migrate.mjs"), []);
} catch (err) {
  console.error("[kitaab] migration failed:", err);
  process.exit(1);
}

const child = spawn(process.execPath, [server], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    HOST: process.env.HOST || "0.0.0.0",
    PORT: process.env.PORT || "3000",
    NITRO_HOST: process.env.NITRO_HOST || process.env.HOST || "0.0.0.0",
    NITRO_PORT: process.env.NITRO_PORT || process.env.PORT || "3000",
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
