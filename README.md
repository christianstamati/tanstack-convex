# tanstack-convex-starter

A boilerplate TypeScript monorepo with a TanStack Start web app, a Convex backend and
shadcn/ui on Base UI, set up to deploy to Cloudflare Workers. Users sign up with email and
password, and pages render on the server as the signed-in user. It includes one example
feature, a private notes list, to show the wiring end to end.

## Stack

| Layer    | Choice                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| Monorepo | Bun workspaces, Vite+ (`vp`) for format, lint, type check, tests and tasks              |
| Frontend | TanStack Start (React) in `apps/web`, with TanStack Query                               |
| Backend  | Convex in `packages/backend`. Functions are the API, no separate server                 |
| Auth     | Convex Auth 2.0 beta, email and password, sessions in httpOnly cookies                  |
| UI       | shadcn/ui on Base UI and Tailwind CSS v4 in `packages/ui`. Nova, neutral, Lucide, Geist |
| Tests    | Vitest, with convex-test for Convex functions                                           |
| CI       | GitHub Actions and the Cloudflare build: check, test, build. Renovate for updates       |
| Deploy   | Cloudflare Workers Builds for the web app, Convex Cloud for the backend, with previews  |

The backend follows
[ianmacartney/code-organization-pattern](https://github.com/ianmacartney/code-organization-pattern).
Each table's functions are defined in `convex/models/<table>/`, and `convex/api/<table>.ts`
re-exports the ones that make up the public API. The web app calls them as
`api.<table>.<function>` through `apps/web/src/lib/api.ts`.

## Quick start

Works on macOS, Linux and Windows (x64).

### With a coding agent

Clone the repo, open a coding agent (Claude Code, Codex, Cursor…) in it and paste:

```text
Set up this repo for local development. Read AGENTS.md and the Quick start in README.md
first. Install the global Vite+ CLI (`vp`) if it is missing, then run `bun install` and
`CONVEX_AGENT_MODE=anonymous bun run setup` from the repo root, so Convex uses a local
deployment without asking to log in. Start `bun run dev` in the background, check that
http://localhost:3000 and its Notes page load, then run `bun run ready`. Don't log in to
Convex or Cloudflare. Tell me what you ran and anything that failed.
```

Or follow the steps below yourself.

### Prerequisites

| Tool         | Version                       | Install                            |
| ------------ | ----------------------------- | ---------------------------------- |
| Git          | any recent                    | [git-scm.com](https://git-scm.com) |
| Vite+ (`vp`) | global CLI                    | see below                          |
| Node         | 24.22.1, from `.node-version` | installed by `vp`                  |
| Bun          | 1.4.4, from `packageManager`  | installed by `vp`                  |

Install the global `vp` CLI and let it manage Node and package managers when the installer
asks:

```sh
# macOS / Linux
curl -fsSL https://vite.plus | bash
```

```powershell
# Windows (PowerShell), or run vp-setup.exe from https://setup.viteplus.dev
irm https://vite.plus/ps1 | iex
```

Open a new terminal. In this repo, `node` and `bun` then resolve to the versions the
repo pins; `vp env current` shows them. If you already have Node 24 and Bun 1.4.4
installed yourself, you can skip `vp`: the repo's `vp` comes from `node_modules`.

No Convex or Cloudflare account is needed to start.

### Run it

```sh
git clone <this repo>
cd tanstack-convex-starter
bun install     # dependencies and the Git hooks
bun run setup   # local Convex deployment and apps/web/.env.local
bun run dev     # Convex + http://localhost:3000
```

`setup` creates a Convex deployment that runs on your machine and stores its data in
`packages/backend/.convex/`, and sets the variables auth needs on it. It is safe to re-run,
and needed again after pulling the change that added auth. Open http://localhost:3000, sign
up and try the Notes page.

Sign-up sends a link to verify the email. Until you set `RESEND_API_KEY` (see
[Auth](#auth)), emails aren't sent: the email and its link appear in the output of
`bun run dev`. Open the link in the browser you signed up in.

The Convex CLI may ask you one of two questions. To keep developing locally:

| Question                                                                                                                 | When                                                                     | Answer                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Welcome to Convex! Would you like to login to your account?                                                              | The first `setup`                                                        | **Start without an account (run Convex locally)**    |
| CONVEX_DEPLOYMENT is configured with deployment …, which is not linked with your account. Would you like to link it now? | Every `setup` and `dev`, if you have logged in to Convex on this machine | **n**. **Y** moves the app to a Convex Cloud project |

On Windows, use PowerShell or Windows Terminal. Git Bash works too. The Git hooks run under
the `sh` that ships with Git for Windows. A few commands in this README are written for `sh`:
in PowerShell, set a `NAME=value` prefix first with `$env:NAME = "value"`, and run the parts
of an `a && b` one at a time. Git Bash runs them as written.

Other commands:

```sh
bun run convex:dashboard  # Convex dashboard on http://127.0.0.1:6790, while `dev` runs
bun run convex:reset      # delete every document on the dev deployment, components included
bun run convex:seed       # sample users who can sign in, with notes. Safe to re-run
bun run check             # format, lint, types. `vp check --fix` fixes what it can
bun run test              # unit tests
bun run build             # production build of apps/web
```

`convex:seed` signs up ada@example.com and grace@example.com, verifies their emails, and gives
each a name and two notes. Both sign in with the password `seeded password 1234`. It skips an
email that already has an account, so after `convex:reset` it seeds again. It runs only while
`SITE_URL` is a localhost URL and `RESEND_API_KEY` is unset, so the known password never
reaches a deployment others can open. The users are in `packages/backend/convex/models/seed/`.

## Environment variables

`bun run setup` writes the local files. `.env.example` documents every variable.

| Variable                        | Where                               | Set by                                 | Purpose                                   |
| ------------------------------- | ----------------------------------- | -------------------------------------- | ----------------------------------------- |
| `VITE_CONVEX_URL`               | `apps/web/.env.local`, deploy build | `scripts/sync-env.ts`, `convex deploy` | Convex URL the browser connects to        |
| `CONVEX_DEPLOYMENT`             | `packages/backend/.env.local`       | `convex dev`                           | Deployment the Convex CLI targets         |
| `CONVEX_URL`, `CONVEX_SITE_URL` | `packages/backend/.env.local`       | `convex dev`                           | Deployment URLs                           |
| `CONVEX_DEPLOY_KEY`             | Workers Builds secret               | you                                    | Deploys `main` to Convex production       |
| `CONVEX_PREVIEW_DEPLOY_KEY`     | Workers Builds secret               | you                                    | Deploys other branches to Convex previews |

Env vars a Convex function reads live on the deployment, not in a file. They are declared in
`packages/backend/convex/convex.config.ts`, and a push fails while a required one is missing.
Set them from `packages/backend` with `bunx convex env set NAME value`.

| Variable                        | Required | Set by                    | Purpose                                       |
| ------------------------------- | -------- | ------------------------- | --------------------------------------------- |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | yes      | `bun run convex:auth-env` | Key pair that signs the access tokens         |
| `SITE_URL`                      | yes      | `bun run convex:auth-env` | The web app's origin; email links point at it |
| `RESEND_API_KEY`                | no       | you                       | Sends auth emails. Without it they're logged  |
| `AUTH_EMAIL_FROM`               | no       | you                       | From address on your Resend domain            |

## Auth

[Convex Auth](https://github.com/get-convex/convex-auth) 2.0.0-beta.0 with email and
password: sign-up verifies the email with a link, and a forgotten password is reset with
one. The session lives in httpOnly cookies on the web app's origin, through
[@samebase/convex-auth-tanstack-start](https://github.com/samebase/convex-hosting/tree/main/packages/convex-auth-tanstack-start),
so the server renders each page as the user. Convex Auth doesn't ship a TanStack Start
integration yet; that package is the interim one, and it requires exactly this beta.
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) lists what the beta can't do yet and what isn't built.

- `apps/web/src/server.ts`, the Worker, answers `/auth/signin`, `/auth/refresh` and
  `/auth/signout` and passes the session to TanStack Start.
- Pages under `apps/web/src/routes/_authed/` need a session. Without one, the visitor goes
  to `/signin` and comes back after signing in.
- The pages are `/signin`, `/signup`, `/verify-email`, `/forgot-password` and
  `/reset-password`.
- In Convex, `authQuery`, `authMutation` and `authAction` from `convex/lib/auth.ts` require
  a session and give the handler `ctx.userId`.
- Sign-up creates the user before the email is verified. A day later, a scheduled
  `removeUnverifiedUser` deletes the user if they never verified it. For users created before
  that check existed, run
  `bunx convex run internal/users:removeUnverifiedUsers` in `packages/backend`. Add
  `"{includeRecent: true}"` to skip the 24-hour wait, which also removes anyone who just
  signed up and hasn't opened their link yet.

### Rate limits

Convex Auth limits sign-in attempts and auth emails by itself. Limits on the app's own functions
live in `packages/backend/convex/lib/rateLimits.ts`, on the
[rate limiter component](https://www.convex.dev/components/rate-limiter). A function calls
`enforceRateLimit(ctx, name, ctx.userId)` before doing its work, and over the limit it throws
`rate_limited`, which the web app shows as "Too many requests. Try again in N seconds." The
example: `notes.create` lets a user add 10 notes at once, then 30 a minute.

To send real emails, create a [Resend](https://resend.com) API key, verify a domain, and set
`RESEND_API_KEY` and `AUTH_EMAIL_FROM` (such as `My App <auth@example.com>`) on the
deployment. Resend's default sender, `onboarding@resend.dev`, only delivers to your own
Resend account's address.

## Deploy

Cloudflare Workers Builds builds and deploys the app from the GitHub repo. Every push to
`main` deploys production. Every other branch gets a preview: a Cloudflare Preview URL,
posted on its pull request, backed by its own Convex preview deployment.

### Requirements

| Need                                                        | Required | For                                                                       |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| A GitHub repo with this code                                | yes      | Workers Builds builds from it and posts Preview URLs on its pull requests |
| [Convex Cloud](https://dashboard.convex.dev) account        | yes      | The production deployment and one preview deployment per branch           |
| [Cloudflare](https://dash.cloudflare.com) account           | yes      | The Worker, its workers.dev URL, and Workers Builds                       |
| The [Quick start](#quick-start) done                        | yes      | `bun install` and `bun run setup`, so the CLIs and scripts run            |
| [Resend](https://resend.com) account with a verified domain | no       | Sends auth emails. Without it they're only logged, so no one can verify   |

### With a coding agent

Log in to Convex and Cloudflare first, so the agent never signs in for you:
`cd packages/backend && bunx convex login`, then `cd apps/web && bunx cf auth login`. Then
paste:

```text
Deploy this app to my Convex Cloud and Cloudflare accounts. Read AGENTS.md and the Deploy
section of README.md first. I'm logged in to both CLIs; don't log in or out. The Convex and
Cloudflare MCP servers can't deploy, so use the `convex` and `cf` CLIs.
1. If packages/backend/.env.local points at a local or anonymous deployment, run
   `bunx convex dev --configure` in packages/backend to create a Convex Cloud project, then
   `bun run setup` from the repo root.
2. Find the production deployment's URL (`https://<name>.<region>.convex.cloud`) with the
   Convex MCP `status` tool on packages/backend, or in the dashboard. Build the web app
   against it: `VITE_CONVEX_URL=<url> bun run --cwd apps/web build`, then run
   `bunx cf deploy --prebuilt` in apps/web. It prints the workers.dev URL; SITE_URL needs it.
3. From the repo root, run `bun run convex:auth-env --prod --site-url <workers.dev URL>`
   and `bun run convex:auth-env --preview --site-url <workers.dev URL>`. Then run
   `bunx convex deploy -y` in packages/backend.
4. Check that <workers.dev URL>/health answers {"status":"ok","convex":"up"} and /signin
   loads without console errors. Don't sign up on production; I'll do that.
5. Create the production deploy key with `bunx convex deployment token create
   workers-builds-prod --prod --save-env <a file outside the repo>`, and don't print it.
6. Stop and give me the steps that need me: generate a Preview deploy key in the Convex
   dashboard, connect the repo under the Worker's Settings > Build with the settings in the
   README's table, and add CONVEX_DEPLOY_KEY (from that file) and CONVEX_PREVIEW_DEPLOY_KEY
   as build secrets. Never paste keys into a dashboard yourself.
When I say it's connected, check with the `cf builds` commands that both the production and
the previews build settings match the README's table (connecting fills in Cloudflare's
defaults) and that each has its deploy key, by name only. Fix the settings, not the secrets.
Then push a new branch, open a pull request, and check that its build posts a Preview URL,
creates a Convex preview deployment, and that the preview's /health answers ok. Once its
`ready` check has run, protect main with the ruleset command in the README's By hand step 4.
Tell me what you ran, the URLs, and anything that failed.
```

### By hand

1. Link a Convex Cloud project: `cd packages/backend && bunx convex login && bunx convex dev --configure`.
   This replaces the local deployment in `packages/backend/.env.local`. Run
   `bun run setup` again to point the web app at it.
2. In the Convex dashboard, generate a production deploy key and a preview deploy key.
   Set the auth variables on production, and as the defaults that each new preview
   deployment copies, each with its own key pair:

   ```sh
   bun run convex:auth-env --prod --site-url https://tanstack-convex-starter.<subdomain>.workers.dev
   bun run convex:auth-env --preview --site-url https://tanstack-convex-starter.<subdomain>.workers.dev
   ```

   Add `RESEND_API_KEY` and `AUTH_EMAIL_FROM` the same way (`bunx convex env set --prod`,
   `bunx convex env default set --type preview`). Each preview deployment
   starts with production's `SITE_URL`, and the build then points it at the branch's
   Preview URL, so a preview's emails link to that preview.

3. In the Cloudflare dashboard, go to Workers & Pages > Create > Import a repository, pick
   this repo and set:

   | Setting         | Value                                                                    |
   | --------------- | ------------------------------------------------------------------------ |
   | Project name    | `tanstack-convex-starter`, the `name` in `apps/web/cloudflare.config.ts` |
   | Root directory  | `apps/web`                                                               |
   | Build command   | `bun run build:cloudflare`                                               |
   | Deploy command  | `bunx cf deploy --prebuilt`                                              |
   | Preview command | `bunx cf previews deploy --prebuilt`                                     |
   | Build variables | `BUN_VERSION` = `1.4.4`, `SKIP_DEPENDENCY_INSTALL` = `1`                 |
   | Build secrets   | `CONVEX_DEPLOY_KEY`, `CONVEX_PREVIEW_DEPLOY_KEY`                         |

   Settings > Build has a Production tab and a Previews Base tab, and connecting the repo
   fills both with Cloudflare's defaults: set both, with the preview command on Previews
   Base. Production needs `CONVEX_DEPLOY_KEY` and Previews Base `CONVEX_PREVIEW_DEPLOY_KEY`.
   Check that `main` is the production branch. Each branch copies Previews Base on its first
   push, so set it up before pushing branches. The commands use `bunx`, not the default
   `npx`, because npm refuses to run in a repo whose `devEngines` names Bun.

4. Protect `main`, from the repo root, with the [GitHub CLI](https://cli.github.com) signed
   in as a repo admin:

   ```sh
   gh api --method POST repos/{owner}/{repo}/rulesets --input .github/rulesets/main.json
   ```

   The build runs no checks, so this ruleset is what keeps failing code out of production.
   It needs the `ready` check to have run once, which the first push does. In a private repo
   without GitHub Advanced Security, CodeQL doesn't run, so first remove the `code_scanning`
   rule from the file, or no pull request can merge.

The build command runs `scripts/cloudflare-build.ts`. It installs the workspace from the
repo root, then runs `convex deploy`, which pushes the Convex functions and builds the app
with `VITE_CONVEX_URL` pointing at them. On `main` it uses `CONVEX_DEPLOY_KEY` and the
production deployment. On any other branch it uses `CONVEX_PREVIEW_DEPLOY_KEY`, which
creates a Convex preview deployment named after the branch and reuses it on later pushes.
Off `main`, it sets `CLOUDFLARE_PREVIEW_BUILD=true`, so the build is a preview build. The
build writes the Worker to `apps/web/.cloudflare/output/`, and Cloudflare then runs the deploy
command on `main` and the preview command elsewhere, both with `--prebuilt` so they deploy
that output instead of building again. Each build is reported as a check on the commit. The
Worker's settings live in `apps/web/cloudflare.config.ts`, read by the Cloudflare Vite plugin
2.0 beta and the `cf` CLI beta; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

The build script runs no checks. GitHub Actions runs `bun run ready` (format, lint, type
check, tests and the build) on every pull request and push to `main`
(`.github/workflows/ci.yml`, the `ready` check). It needs no secrets and deploys nothing, so
it also checks pull requests from forks and copies of the repo that aren't connected to
Cloudflare.

Workers Builds deploys without waiting for GitHub Actions, so `main` is protected by the
ruleset in `.github/rulesets/main.json`: changes go in through a pull request, which can
only merge once `ready` passes and CodeQL has scanned it, and nobody can push to `main`
directly, admins included. CodeQL blocks the merge on a security alert of high severity or
above, or on any other alert at error level.
Each PR gets a Cloudflare preview, built whether or not its checks pass, and merging
deploys production. To change the ruleset, edit the file and update it with
`gh api --method PUT repos/{owner}/{repo}/rulesets/<id> --input .github/rulesets/main.json`
(`gh api repos/{owner}/{repo}/rulesets` lists the ids). `bun run dev` and `vp preview` run
the app in workerd, the Workers runtime, so what you test locally is what deploys.

### Health check

`GET /health` on the web app answers `{"status":"ok","convex":"up"}` with status 200 while the
Worker runs and reaches Convex, and `{"status":"degraded","convex":"unreachable"}` with 503 when
Convex doesn't answer within 3 seconds. Point an uptime monitor at it. It asks the Convex
deployment's `/version`, so a check runs no Convex function.

### Search and link previews

`apps/web/src/lib/meta.ts` holds the app's name and description, which every page's tags start
from: the description and the Open Graph tags that link previews read. Each page sets its own
title with `pageMeta`. Pages that need a session are `noindex`, and
`apps/web/public/robots.txt` allows the rest. To show an image in link previews, set
`og:image` in `siteMeta()` to an absolute URL of a 1200×630 PNG.

## Security checks

GitHub Actions runs these on every pull request and push to `main`:

| Check       | Workflow     | What it does                                                                                                                                                                                              |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit`     | `ci.yml`     | `bun audit` on `bun.lock`, also every Monday. Fails on high or critical advisories in production dependencies; advisories in dev tooling (the Cloudflare CLI, the shadcn CLI…) only go to the job summary |
| `workflows` | `ci.yml`     | [zizmor](https://docs.zizmor.sh) audits the workflows: broad permissions, unpinned actions, credentials left in checkouts, template injection                                                             |
| `analyze`   | `codeql.yml` | [CodeQL](https://codeql.github.com) scans the TypeScript and the workflows. Results go to Security > Code scanning. Free on public repos; skipped on private ones without GitHub Advanced Security        |

To accept an advisory that doesn't affect the app, add `--ignore=<GHSA id>` to the audit
step in `ci.yml` with a comment saying why. Workflow actions are pinned to commit SHAs, and
Renovate keeps them current. GitHub's secret scanning and push protection are on for the
repo in its settings; they aren't workflows.

To deploy production by hand instead: sign in with `bunx cf auth` in `apps/web`, then
`CONVEX_DEPLOY_KEY=... bun run --cwd packages/backend deploy && bun run --cwd apps/web deploy`.
That deploy skips the checks: run `bun run ready` first.

## Dependency updates

[Renovate](https://docs.renovatebot.com) opens pull requests that update the dependencies,
Node (`.node-version`), Bun (`packageManager` and `devEngines`) and the GitHub Actions, on
Monday mornings. To turn it on, install the [Renovate GitHub App](https://github.com/apps/renovate)
on the repo and merge the onboarding PR it opens. `renovate.json` holds the rules:

- Related packages update together in one PR: `convex`, `tanstack`, `cloudflare`,
  `vite-plus`.
- Convex Auth's beta and its TanStack Start adapter never update on their own. They're
  listed on the Dependency Dashboard issue, and a PR opens only when you tick them there.
- A Convex update can change `packages/backend/convex/_generated/`, which CI doesn't
  regenerate. Run `bun run setup` on the branch and commit any change before merging.
- Renovate doesn't read Bun's `workspaces.catalog` yet, so a custom rule tracks the Vite+
  versions in it, but can't update `bun.lock` for them. Run `bun install` on the branch and
  push the lockfile.

- Security fixes open right away, whatever the schedule. Renovate checks the
  [OSV](https://osv.dev) database, so this works without GitHub's Dependabot alerts.
- Workflow actions are pinned to commit SHAs and update together in one PR, along with the
  zizmor version in `ci.yml`.

Each Renovate branch also gets a Cloudflare preview and a Convex preview deployment.

## Remove the example feature

Delete these files and lines, then run `bun run check`:

- `packages/backend/convex/models/notes/`, `packages/backend/convex/api/notes.ts` and
  `packages/backend/convex/tests/notes/`
- the `notes` table and its import in `packages/backend/convex/schema.ts`
- the `createNote` limit in `packages/backend/convex/lib/rateLimits.ts`
- `apps/web/src/routes/_authed/notes.tsx`
- the Notes links in `apps/web/src/routes/index.tsx` and `apps/web/src/routes/__root.tsx`
- `AFTER_SIGN_IN` in `apps/web/src/lib/auth.ts`: point it at your first private page
- the `notes` of each seed user, and the insert below them, in
  `packages/backend/convex/models/seed/functions.ts`

`bun run dev` regenerates `apps/web/src/routeTree.gen.ts` and `convex/_generated`.
