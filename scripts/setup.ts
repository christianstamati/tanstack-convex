// One-time local setup, safe to re-run: provisions a local Convex deployment (no
// account needed), sets the variables Convex Auth needs on it, pushes the functions, and
// writes VITE_CONVEX_URL for the web app.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureAuthEnv } from "./auth-env.js";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");
const backendEnv = join(backendDir, ".env.local");

function run(command: string, args: string[], cwd = root) {
  return spawnSync(command, args, { cwd, stdio: "inherit" }).status === 0;
}

const hasDeployment = () =>
  existsSync(backendEnv) && /^CONVEX_DEPLOYMENT=./m.test(readFileSync(backendEnv, "utf8"));

// The running Bun binary, not "bun" on PATH: on Windows that can be a .cmd shim (vp's or
// npm's), which spawnSync can't run without a shell.
const bun = process.execPath;
const convexDev = () => run(bun, ["x", "convex", "dev", "--once"], backendDir);

// A new deployment's first push fails until the auth variables exist, but it creates the
// deployment they go on.
if (!hasDeployment()) {
  convexDev();
  if (!hasDeployment()) process.exit(1);
  console.log(
    "The push above fails on a new deployment. Setting its auth variables, then pushing.",
  );
}
const ok =
  ensureAuthEnv("dev", "http://localhost:3000") && convexDev() && run(bun, ["scripts/sync-env.ts"]);
process.exit(ok ? 0 : 1);
