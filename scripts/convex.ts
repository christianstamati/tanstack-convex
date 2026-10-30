// The Convex dev deployment the app uses, named in packages/backend/.env.local.
//
//   bun run convex:local    switches to an anonymous deployment on this machine: no account, no login
//   bun run convex:cloud    switches to your dev deployment on Convex Cloud: logs in, and links a
//                           project the first time
//   bun run convex:which    prints the deployment in use, changing nothing
//   bun run convex:reset    deletes every document on it, components included. Asks first, unless
//                           `--skip-confirmation` (or `--yes`, `-y`)
//   bun run convex:local:delete
//                           deletes the anonymous deployment, data included. Asks first, as
//                           `reset` does. `bun run setup` makes a new one
//   bun run convex:update:skills
//                           refreshes Convex's agent files in packages/backend
//
// A switch selects the deployment, sets the auth variables on it if they're missing, pushes the
// functions, and points the web app at it. Each deployment keeps its own data and env vars;
// nothing is copied between them. Restart `bun run dev` after switching: Convex and Vite read
// the env files only when they start.
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
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { ensureAuthEnv } from "./auth.js";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");
const backendEnv = join(backendDir, ".env.local");
const webEnv = join(root, "apps/web/.env.local");
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

/**
 * Whether .env.local names a local deployment that no longer exists, as after deleting .convex.
 * The CLI refuses every command until it names one that does. It looks where this does: in the
 * local slot, then in the folder in the home directory that older CLIs used.
 */
export function isLocalDeploymentGone() {
  const { where, name } = current() ?? {};
  if (where !== "local" || !name) return false;
  const legacy = join(homedir(), ".convex/anonymous-convex-backend-state", name, "config.json");
  return localDeploymentName() !== name && !existsSync(legacy);
}

/** The anonymous deployment parked in .convex/local, if any. */
const parkedAnonymous = () =>
  existsSync(localDir)
    ? readdirSync(localDir).find((dir) => dir.startsWith("anonymous-"))
    : undefined;

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
  const parked = parkedAnonymous();
  if (!existsSync(localState) && parked) {
    renameSync(join(localDir, parked), localState);
    console.log(`Using the anonymous local deployment ${parked} again.`);
  }
  // With CONVEX_DEPLOYMENT empty (dotenv doesn't replace a variable that's set), the CLI picks the
  // anonymous deployment, creating one the first time, and writes it to .env.local. A new one's
  // push fails until the auth variables exist, which are set after it.
  convex(["dev", "--once"], { env: { CONVEX_DEPLOYMENT: "" } });
  return current()?.where === "local" && !isLocalDeploymentGone();
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
    // until the auth variables exist, which are set after it.
    convex(["dev", "--configure", "--dev-deployment", "cloud", "--once"], { prompts: true });
  }
  return current()?.where === "cloud";
}

const syncEnv = () =>
  spawnSync(bun, ["scripts/sync-env.ts"], { cwd: root, stdio: "inherit" }).status === 0;

async function switchTo(target: Where) {
  const before = current();
  const gone = target === "local" && isLocalDeploymentGone();
  if (before && before.where === target && !gone) {
    // No push: `bun run dev` may be running against it, and a local deployment's backend can't
    // start twice. It pushes the functions itself.
    console.log(`Already on the ${target} deployment ${before.name}.`);
    return ensureAuthEnv("dev", "http://localhost:3000") && syncEnv();
  }
  if (gone && !parkedAnonymous()) {
    console.log(`The local deployment ${before?.name} no longer exists on this machine.`);
  }
  rememberCloudProject();
  if (!(target === "local" ? await selectLocal() : selectCloud())) {
    console.error(
      `Couldn't switch to a ${target} deployment.` +
        (before ? ` Still on ${before.deployment}.` : ""),
    );
    return false;
  }
  rememberCloudProject();
  if (!(ensureAuthEnv("dev", "http://localhost:3000") && convex(["dev", "--once"]) && syncEnv())) {
    return false;
  }
  console.log(
    `\nNow on the ${target} deployment ${current()?.name}. Restart \`bun run dev\` if it's` +
      " running. Its data is its own: `bun run convex:seed` adds the sample user.",
  );
  return true;
}

async function confirmed(question: string, word: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} Type "${word}" to confirm: `);
  rl.close();
  return answer.trim() === word;
}

/** Removes the lines with these prefixes, and the blank lines around them. */
function removeEnvLines(file: string, prefixes: string[]) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => !prefixes.some((prefix) => line.startsWith(prefix)));
  const kept = lines.filter((line, i) => line !== "" || (lines[i - 1] ?? "") !== "");
  while (kept.at(-1) === "") kept.pop();
  writeFileSync(file, kept.length > 0 ? `${kept.join("\n")}\n` : "");
}

/**
 * Deletes the anonymous local deployment, and stops the env files naming it. A local deployment
 * made with an account stays, and so does a cloud deployment in use. `CONVEX_CLOUD_PROJECT` stays
 * too, so `convex:cloud` still goes back to the project.
 */
async function deleteLocal(skipConfirmation: boolean) {
  const slotName = localDeploymentName();
  const inSlot = slotName?.startsWith("anonymous-");
  const name = inSlot ? slotName : parkedAnonymous();
  if (name) {
    if (inSlot && (await isRunning(localState))) {
      console.error(`The local deployment ${name} is running. Stop \`bun run dev\` first.`);
      return false;
    }
    const question = `Delete the local deployment ${name} and all its data, including all users?`;
    if (!skipConfirmation && !(await confirmed(question, "delete"))) {
      console.log("Nothing deleted.");
      return false;
    }
    rmSync(inSlot ? localState : join(localDir, name), { recursive: true, force: true });
    console.log(`Deleted the local deployment ${name}.`);
  } else {
    console.log("There's no anonymous local deployment to delete.");
  }
  if (current()?.where === "local") {
    // The comment too: the CLI writes it again with each new deployment.
    removeEnvLines(backendEnv, [
      "# Deployment used by",
      "CONVEX_DEPLOYMENT=",
      "CONVEX_URL=",
      "CONVEX_SITE_URL=",
    ]);
    removeEnvLines(webEnv, ["VITE_CONVEX_URL="]);
    console.log("`bun run setup` makes a new one.");
  }
  return true;
}

/**
 * Imports an empty snapshot with `convex import --replace-all`, which clears every table it
 * doesn't contain: the app's and the components' (users, sessions, passwords, emails…). The
 * functions, the schema and the env vars stay. A local deployment must be running
 * (`bun run dev`). It never touches production: `convex import` targets the dev deployment.
 */
async function reset(skipConfirmation: boolean) {
  const { deployment } = current()!;
  const question = `Delete every document on the dev deployment ${deployment}, including all users?`;
  if (!skipConfirmation && !(await confirmed(question, "reset"))) {
    console.log("Nothing deleted.");
    return false;
  }
  // An empty ZIP archive: only the end-of-central-directory record.
  const dir = mkdtempSync(join(tmpdir(), "convex-reset-"));
  const emptySnapshot = join(dir, "empty.zip");
  writeFileSync(emptySnapshot, Buffer.concat([Buffer.from("PK\x05\x06"), Buffer.alloc(18)]));
  const ok = convex(["import", "--replace-all", "--yes", emptySnapshot]);
  rmSync(dir, { recursive: true, force: true });
  if (ok) console.log(`Cleared every table on ${deployment}.`);
  return ok;
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "skip-confirmation": { type: "boolean" }, yes: { type: "boolean", short: "y" } },
  });
  const command = positionals[0];
  const skipConfirmation = Boolean(values["skip-confirmation"] || values.yes);
  const before = current();
  // `local` and `cloud` also start from nothing: `bun run setup` runs `local` on a fresh clone.
  if (!before && (command === "which" || command === "reset")) {
    console.error("No deployment in packages/backend/.env.local. Run `bun run setup` first.");
    process.exit(1);
  }
  let ok: boolean;
  if (command === "local" || command === "cloud") {
    ok = await switchTo(command);
  } else if (command === "delete") {
    ok = await deleteLocal(skipConfirmation);
  } else if (command === "which") {
    console.log(
      `${before!.where ?? "unknown"}: ${before!.name} (${before!.url ?? "no CONVEX_URL"})`,
    );
    ok = true;
  } else if (command === "reset") {
    ok = await reset(skipConfirmation);
  } else if (command === "skills") {
    // Convex installs the skills with `npm exec`, and the variable gets past npm's refusal to run
    // in a repo whose root package.json has `devEngines` naming Bun.
    ok = convex(["ai-files", "update"], { env: { npm_config_force: "true" } });
  } else {
    console.error(
      "Usage: bun scripts/convex.ts <local|cloud|delete|which|reset|skills> [--skip-confirmation]",
    );
    ok = false;
  }
  process.exit(ok ? 0 : 1);
}
