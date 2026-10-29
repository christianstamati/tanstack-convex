// Switches the app between the Convex deployment that runs on your machine and your personal dev
// deployment on Convex Cloud. It selects the deployment in packages/backend/.env.local, sets the
// auth variables on it if they're missing, pushes the functions, and points the web app at it.
//
//   bun run convex:local    the local deployment, which needs no account
//   bun run convex:cloud    your cloud dev deployment: logs in and links a project first if needed
//   bun run convex:which    prints the deployment in use, changing nothing
//
// Each deployment keeps its own data and env vars; nothing is copied between them. Restart
// `bun run dev` after switching: Convex and Vite read the env files only when they start.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { ensureAuthEnv } from "./auth-env.js";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");
const backendEnv = join(backendDir, ".env.local");

type Where = "local" | "cloud";

// The running Bun binary, not "bun" on PATH, as in setup.ts.
const bun = process.execPath;
const convex = (...args: string[]) =>
  spawnSync(bun, ["x", "convex", ...args], { cwd: backendDir, stdio: "inherit" }).status === 0;

/** The deployment `convex dev` targets, from packages/backend/.env.local. */
function current() {
  const env = existsSync(backendEnv) ? readFileSync(backendEnv, "utf8") : "";
  const deployment = env.match(/^CONVEX_DEPLOYMENT=([^#\s]+)/m)?.[1];
  const url = env.match(/^CONVEX_URL=(\S+)/m)?.[1];
  if (!deployment) return undefined;
  // `local:` and `anonymous:` deployments run on this machine, `dev:` ones on Convex Cloud.
  const [kind, name] = deployment.split(":");
  const where: Where | undefined =
    kind === "local" || kind === "anonymous" ? "local" : kind === "dev" ? "cloud" : undefined;
  return { deployment, name, where, url };
}

// The CLI keeps one local deployment per project, here.
const localState = join(backendDir, ".convex/local/default");

/** The local deployment's name, from the CLI's config for it. */
function localDeploymentName() {
  const file = join(localState, "config.json");
  if (!existsSync(file)) return undefined;
  return (JSON.parse(readFileSync(file, "utf8")) as { deploymentName?: string }).deploymentName;
}

function selectLocal() {
  const name = localDeploymentName();
  if (name?.startsWith("anonymous-")) {
    // One made without an account can't be selected from a cloud project (the CLI asks Convex
    // Cloud for its project, which has none), and the CLI won't create another while it's there.
    // Moving it aside keeps its data on disk.
    let aside = join(backendDir, ".convex/local", name);
    if (existsSync(aside)) aside += `-${Date.now()}`;
    renameSync(localState, aside);
    console.log(
      `The local deployment ${name} was made without an account, so it can't be selected from` +
        ` your Convex Cloud project. Moved it to ${relative(root, aside)}, data included, and` +
        " creating a local deployment in the project.",
    );
  }
  return localDeploymentName()
    ? convex("deployment", "select", "local")
    : convex("deployment", "create", "local", "--select");
}

function select(target: Where) {
  if (target === "local") return selectLocal();
  // Without a linked project, `deployment select dev` fails. Configuring one creates the cloud dev
  // deployment, whose first push fails until the auth variables exist, as in setup.ts.
  if (!convex("login")) return false;
  if (!convex("deployment", "select", "dev")) {
    console.log("Linking a Convex Cloud project instead.");
    convex("dev", "--configure", "--dev-deployment", "cloud", "--once");
  }
  return current()?.where === "cloud";
}

const { positionals } = parseArgs({ allowPositionals: true });
const command = positionals[0];
if (command !== "local" && command !== "cloud" && command !== "which") {
  console.error("Usage: bun scripts/use-convex.ts <local|cloud|which>");
  process.exit(1);
}

const before = current();
if (command === "which") {
  if (!before) {
    console.error("No deployment in packages/backend/.env.local. Run `bun run setup` first.");
    process.exit(1);
  }
  console.log(`${before.where ?? "unknown"}: ${before.name} (${before.url ?? "no CONVEX_URL"})`);
  process.exit(0);
}

if (!before) {
  console.error("No deployment in packages/backend/.env.local. Run `bun run setup` first.");
  process.exit(1);
}
if (before.where === command) {
  console.log(`Already on the ${command} deployment ${before.name}. Making sure it's set up.`);
} else if (!select(command)) {
  console.error(`Couldn't switch to a ${command} deployment. Still on ${before.deployment}.`);
  process.exit(1);
}

const ok =
  ensureAuthEnv("dev", "http://localhost:3000") &&
  convex("dev", "--once") &&
  spawnSync(bun, ["scripts/sync-env.ts"], { cwd: root, stdio: "inherit" }).status === 0;
if (!ok) process.exit(1);

const after = current();
console.log(
  `\nNow on the ${command} deployment ${after?.name}. Restart \`bun run dev\` if it's running.` +
    (before.deployment === after?.deployment
      ? ""
      : " Its data is its own: `bun run convex:seed` adds the sample users."),
);
