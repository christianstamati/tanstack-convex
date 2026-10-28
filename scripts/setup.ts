// One-time local setup, safe to re-run: provisions a local Convex deployment (no
// account needed), pushes the functions, and writes VITE_CONVEX_URL for the web app.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");

function run(command: string, args: string[], cwd = root) {
  return spawnSync(command, args, { cwd, stdio: "inherit" }).status === 0;
}

// The running Bun binary, not "bun" on PATH: on Windows that can be a .cmd shim (vp's or
// npm's), which spawnSync can't run without a shell.
const bun = process.execPath;
const ok =
  run(bun, ["x", "convex", "dev", "--once"], backendDir) && run(bun, ["scripts/sync-env.ts"]);
process.exit(ok ? 0 : 1);
