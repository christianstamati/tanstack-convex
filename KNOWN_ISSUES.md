# Known issues

Auth runs on [Convex Auth](https://github.com/get-convex/convex-auth) 2.0.0-beta.0 and
[@samebase/convex-auth-tanstack-start](https://github.com/samebase/convex-hosting/tree/main/packages/convex-auth-tanstack-start)
0.1.1, both pinned to exact versions. This file lists what the beta can't do yet, what we
haven't built, and the workarounds in the code. When you upgrade, check each item again and
remove the ones that are fixed.

## Limits of the Convex Auth beta

- **Users can't be deleted completely.** The beta has no function to delete a user's account
  (`auth` component, `accounts` table) or password hash (`authPassword` component), only the
  email component's `verifiedEmails.deleteUser`. `removeIfUnverified` in
  `convex/models/users/functions.ts` deletes the user and their email data and leaves those two
  rows behind. They are unreachable, because sign-in finds a user only through a verified email.
  When the beta adds the functions, call them there.
- **A verification link can't be sent again.** The sign-up link works for an hour and email and
  password has no resend. A user who misses it can't sign in, and is removed after 24 hours
  (`UNVERIFIED_USER_TTL_MS`), after which they can sign up again.
- **Emails go through Resend only, with fixed text.** The beta sends through `@convex-dev/resend`
  and doesn't let the app change the subject or the body. Without `RESEND_API_KEY`, `logEmail`
  in `convex/models/users/auth.ts` stands in for Resend: it logs each email and stores it in the
  `devMailbox` table.
- **No magic links or one-time codes.** Email and password is the only email-based method.
- **Sessions aren't checked on each request.** `getAuthUserId` trusts the access token until it
  expires, about a minute, so a signed-out or deleted session keeps working until then.
- **No TanStack Start integration in Convex Auth.** It ships one for Next.js only.
  `@samebase/convex-auth-tanstack-start` fills the gap until Convex Auth has its own, and needs
  exactly 2.0.0-beta.0. Its `convexAuth()` Vite plugin resolves a file that the beta's exports
  map hides.
- **The setup CLI doesn't run in this repo.** `npx @convex-dev/auth` sets the keys with `npx`,
  which npm refuses here because `devEngines` names Bun. `scripts/auth-env.ts` generates the
  keys in the same format instead.
- **Test helpers need workarounds.** The beta's convex-test helpers ship as TypeScript with
  `.ts` imports (`allowImportingTsExtensions` in `convex/tsconfig.json`), and its password hashing
  imports a `.wasm` file that Vitest can't load (the `wasm-module` plugin in
  `packages/backend/vite.config.ts`).

## Not built yet

- **Change password and change email.** The beta has `changePassword`, `startChangeEmail` and
  `completeChangeEmail`, and the React hooks for them. They need exporting from
  `convex/api/auth.ts`, the completing ones adding to the `signIn` list in
  `apps/web/src/server.ts`, and a page for each, plus `/confirm-email-change` for the email link.
- **Deleting your own account.** Blocked by the first item above.
- **Sign-in with OAuth or passkeys.** The beta and the adapter support GitHub, Google, Apple and
  passkeys; none is set up.
- **Avatar upload.** `users.image` exists but nothing sets it.

## Our setup

- **Previews share one `SITE_URL`**, so the links in a preview deployment's emails open
  production's origin. Change a preview's own `SITE_URL` in the Convex dashboard to test its
  emails.
- **The auth pages haven't run in a browser yet.** The flows are tested with convex-test and
  over HTTP against a local deployment, not the React side: hydration, the hooks, and the
  redirects after signing in and out.
