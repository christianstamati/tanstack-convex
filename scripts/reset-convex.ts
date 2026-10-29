// Deletes every document on the dev deployment: the app's tables and the components' (users,
// sessions, passwords, emails…). Functions, the schema and the env vars stay. It imports an empty
// snapshot with `convex import --replace-all`, which clears every table it doesn't contain.
//
//   bun run convex:reset                       asks first
//   bun run convex:reset --skip-confirmation   doesn't ask (or --yes, -y)
//
// It only resets the dev deployment named in packages/backend/.env.local, never production. A
// local deployment must be running (`bun run dev`).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

const backendDir = join(import.meta.dirname, "../packages/backend");
const backendEnv = join(backendDir, ".env.local");

const { values } = parseArgs({
  options: { "skip-confirmation": { type: "boolean" }, yes: { type: "boolean", short: "y" } },
});

const deployment = existsSync(backendEnv)
  ? readFileSync(backendEnv, "utf8").match(/^CONVEX_DEPLOYMENT=([^#\s]+)/m)?.[1]
  : undefined;
if (!deployment) {
  console.error("No dev deployment in packages/backend/.env.local. Run `bun run setup` first.");
  process.exit(1);
}

if (!values["skip-confirmation"] && !values.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Delete every document on the dev deployment ${deployment}, including all users? Type "reset" to confirm: `,
  );
  rl.close();
  if (answer.trim() !== "reset") {
    console.log("Nothing deleted.");
    process.exit(1);
  }
}

// An empty ZIP archive: only the end-of-central-directory record.
const dir = mkdtempSync(join(tmpdir(), "convex-reset-"));
const emptySnapshot = join(dir, "empty.zip");
writeFileSync(emptySnapshot, Buffer.concat([Buffer.from("PK\x05\x06"), Buffer.alloc(18)]));

// The running Bun binary, not "bun" on PATH, as in setup.ts.
const result = spawnSync(
  process.execPath,
  ["x", "convex", "import", "--replace-all", "--yes", emptySnapshot],
  { cwd: backendDir, stdio: "inherit" },
);
rmSync(dir, { recursive: true, force: true });
if (result.status === 0) console.log(`Cleared every table on ${deployment}.`);
process.exit(result.status ?? 1);
