// Switches the app between a Convex deployment on your machine, which needs no account, and your
// personal dev deployment on Convex Cloud. It selects the deployment in
// packages/backend/.env.local, sets the auth variables on it if they're missing, pushes the
// functions, and points the web app at it.
//
//   bun run convex:local    an anonymous deployment on this machine: no account, no login
//   bun run convex:cloud    your cloud dev deployment: logs in, and links a project the first time
//   bun run convex:which    prints the deployment in use, changing nothing
//
// Each deployment keeps its own data and env vars; nothing is copied between them. Restart
// `bun run dev` after switching: Convex and Vite read the env files only when they start.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ensureAuthEnv } from "./auth-env.js";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");
const backendEnv = join(backendDir, ".env.local");
// The CLI keeps the project's one local deployment here.
const localDir = join(backendDir, ".convex/local");
const localState = join(localDir, "default");

type Where = "local" | "cloud";

// The running Bun binary, not "bun" on PATH, as in setup.ts. Without a terminal on stdin, the CLI
// asks nothing: it uses an anonymous local deployment unless .env.local names another, and
// doesn't offer to link an anonymous one to your account.
const bun = process.execPath;
const convex = (args: string[], { prompts = false, env = {} } = {}) =>
  spawnSync(bun, ["x", "convex", ...args], {
    cwd: backendDir,
    stdio: [prompts ? "inherit" : "ignore", "inherit", "inherit"],
    env: { ...process.env, ...env },
  }).status === 0;

const readEnv = () => (existsSync(backendEnv) ? readFileSync(backendEnv, "utf8") : "");

/** The deployment `convex dev` targets, from packages/backend/.env.local. */
function current() {
  const env = readEnv();
  const deployment = env.match(/^CONVEX_DEPLOYMENT=([^#\s]+)/m)?.[1];
  const url = env.match(/^CONVEX_URL=(\S+)/m)?.[1];
  if (!deployment) return undefined;
  // `anonymous:` deployments run on this machine without an account, `dev:` ones on Convex Cloud.
  const [kind, name] = deployment.split(":");
  const where: Where | undefined =
    kind === "anonymous" ? "local" : kind === "dev" ? "cloud" : undefined;
  return { deployment, name, where, url };
}

/** The deployment in the local slot, from the CLI's config for it. */
function localDeploymentName(dir = localState) {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return undefined;
  return (JSON.parse(readFileSync(file, "utf8")) as { deploymentName?: string }).deploymentName;
}

async function isRunning(dir: string) {
  const file = join(dir, "config.json");
  const { ports } = JSON.parse(readFileSync(file, "utf8")) as { ports: { cloud: number } };
  return fetch(`http://127.0.0.1:${ports.cloud}/version`).then(
    (response) => response.ok,
    () => false,
  );
}

async function selectLocal() {
  // A local deployment made with an account (`convex dev --configure` and "local") takes the one
  // local slot, and the CLI would put the anonymous one over it. Park it, data included, and bring
  // back an anonymous one parked earlier.
  const name = localDeploymentName();
  if (name && !name.startsWith("anonymous-")) {
    if (await isRunning(localState)) {
      console.error(`The local deployment ${name} is running. Stop \`bun run dev\` first.`);
      return false;
    }
    renameSync(localState, join(localDir, name));
    console.log(`Moved the local deployment ${name}, data included, to .convex/local/${name}.`);
  }
  const parked = existsSync(localDir)
    ? readdirSync(localDir).find((dir) => dir.startsWith("anonymous-"))
    : undefined;
  if (!existsSync(localState) && parked) {
    renameSync(join(localDir, parked), localState);
    console.log(`Using the anonymous local deployment ${parked} again.`);
  }
  // With CONVEX_DEPLOYMENT empty (dotenv doesn't replace a variable that's set), the CLI picks the
  // anonymous deployment, creating one the first time, and writes it to .env.local. A new one's
  // push fails until the auth variables exist, as in setup.ts.
  convex(["dev", "--once"], { env: { CONVEX_DEPLOYMENT: "" } });
  return current()?.where === "local";
}

// The cloud project, kept in .env.local while the app is local, since an anonymous deployment
// has none and `convex deployment select` then needs it spelled out.
const CLOUD_PROJECT = "CONVEX_CLOUD_PROJECT";

function rememberCloudProject() {
  const env = readEnv();
  const match = env.match(/^CONVEX_DEPLOYMENT=\S+ # team: ([^,\s]+), project: (\S+)/m);
  if (!match) return;
  const lines = env.split(/\r?\n/).filter((line) => !line.startsWith(`${CLOUD_PROJECT}=`));
  while (lines.at(-1) === "") lines.pop();
  lines.push(`${CLOUD_PROJECT}=${match[1]}:${match[2]}`);
  writeFileSync(backendEnv, `${lines.join("\n")}\n`);
}

/** `convex login status` exits 0 either way, and prints the status on stderr. */
function isLoggedIn() {
  const result = spawnSync(bun, ["x", "convex", "login", "status"], {
    cwd: backendDir,
    encoding: "utf8",
  });
  return `${result.stdout}${result.stderr}`.includes("Status: Logged in");
}

/**
 * Logs in from an empty folder: in packages/backend, `convex login` offers to link the anonymous
 * local deployment to the account, which would make it a cloud project's.
 */
function logIn() {
  const dir = mkdtempSync(join(tmpdir(), "convex-login-"));
  const ok = spawnSync(bun, ["x", "convex", "login"], { cwd: dir, stdio: "inherit" }).status === 0;
  rmSync(dir, { recursive: true, force: true });
  return ok;
}

function selectCloud() {
  if (!isLoggedIn() && !logIn()) return false;
  const project = readEnv().match(new RegExp(`^${CLOUD_PROJECT}=(\\S+)`, "m"))?.[1];
  if (!project || !convex(["deployment", "select", `${project}:dev`])) {
    // The first time: pick or create a project, and its dev deployment. Its first push fails
    // until the auth variables exist, as in setup.ts.
    convex(["dev", "--configure", "--dev-deployment", "cloud", "--once"], { prompts: true });
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
if (!before) {
  console.error("No deployment in packages/backend/.env.local. Run `bun run setup` first.");
  process.exit(1);
}
if (command === "which") {
  console.log(`${before.where ?? "unknown"}: ${before.name} (${before.url ?? "no CONVEX_URL"})`);
  process.exit(0);
}

const syncEnv = () =>
  spawnSync(bun, ["scripts/sync-env.ts"], { cwd: root, stdio: "inherit" }).status === 0;

if (before.where === command) {
  // No push: `bun run dev` may be running against it, and a local deployment's backend can't
  // start twice. It pushes the functions itself.
  console.log(`Already on the ${command} deployment ${before.name}.`);
  process.exit(ensureAuthEnv("dev", "http://localhost:3000") && syncEnv() ? 0 : 1);
}
rememberCloudProject();
if (!(command === "local" ? await selectLocal() : selectCloud())) {
  console.error(`Couldn't switch to a ${command} deployment. Still on ${before.deployment}.`);
  process.exit(1);
}
rememberCloudProject();
if (!(ensureAuthEnv("dev", "http://localhost:3000") && convex(["dev", "--once"]) && syncEnv())) {
  process.exit(1);
}
console.log(
  `\nNow on the ${command} deployment ${current()?.name}. Restart \`bun run dev\` if it's` +
    " running. Its data is its own: `bun run convex:seed` adds the sample user.",
);
