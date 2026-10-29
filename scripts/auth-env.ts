// Sets the variables Convex Auth needs on a Convex deployment, leaving any that are already set:
// a fresh signing key pair (AUTH_PRIVATE_KEY, AUTH_JWKS) and the web app's origin (SITE_URL).
// A push fails while one of them is missing.
//
//   bun run convex:auth-env                             the dev deployment (localhost:3000)
//   bun run convex:auth-env --prod --site-url <url>     the production deployment
//   bun run convex:auth-env --preview --site-url <url>  the defaults each new preview copies
//
// `--force` replaces the key pair, which signs everyone out.
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const backendDir = join(import.meta.dirname, "../packages/backend");

export type Target = "dev" | "prod" | "preview";

function convex(target: Target, command: "get" | "set", args: string[]) {
  const scope =
    target === "preview" ? ["env", "default", command, "--type", "preview"] : ["env", command];
  // The running Bun binary, not "bun" on PATH, as in setup.ts.
  return spawnSync(
    process.execPath,
    ["x", "convex", ...scope, ...args, ...(target === "prod" ? ["--prod"] : [])],
    { cwd: backendDir, encoding: "utf8" },
  );
}

/** The value, or "" when the variable isn't set (`convex env get` exits 0 either way). */
function get(target: Target, name: string) {
  return convex(target, "get", [name]).stdout.trim();
}

function set(target: Target, name: string, value: string) {
  // Through a file, not an argument: on Windows, the quotes in AUTH_JWKS's JSON wouldn't survive
  // the command line, and the private key stays out of the process list.
  const dir = mkdtempSync(join(tmpdir(), "auth-env-"));
  const file = join(dir, "value.txt");
  writeFileSync(file, value);
  const result = convex(target, "set", [name, "--from-file", file]);
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error(result.stderr);
    return false;
  }
  console.log(`${target}: set ${name}`);
  return true;
}

/** The key pair in the format of `npx @convex-dev/auth`: a base64 PKCS8 PEM and a JWKS. */
function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    AUTH_PRIVATE_KEY: Buffer.from(pem).toString("base64"),
    AUTH_JWKS: JSON.stringify({ keys: [{ ...jwk, kid: randomUUID(), alg: "RS256", use: "sig" }] }),
  };
}

export function ensureAuthEnv(target: Target, siteUrl: string | undefined, force = false) {
  if (force || !get(target, "AUTH_PRIVATE_KEY") || !get(target, "AUTH_JWKS")) {
    for (const [name, value] of Object.entries(generateKeys())) {
      if (!set(target, name, value)) return false;
    }
  }
  if (siteUrl && get(target, "SITE_URL") !== siteUrl) return set(target, "SITE_URL", siteUrl);
  if (!get(target, "SITE_URL")) {
    console.error(`${target}: SITE_URL is not set. Pass --site-url with the web app's origin.`);
    return false;
  }
  return true;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      prod: { type: "boolean" },
      preview: { type: "boolean" },
      "site-url": { type: "string" },
      force: { type: "boolean" },
    },
  });
  const target: Target = values.prod ? "prod" : values.preview ? "preview" : "dev";
  const siteUrl = values["site-url"] ?? (target === "dev" ? "http://localhost:3000" : undefined);
  process.exit(ensureAuthEnv(target, siteUrl, values.force) ? 0 : 1);
}
