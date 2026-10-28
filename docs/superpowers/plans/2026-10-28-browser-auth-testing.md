# Browser Auth Testing Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run every auth flow once in a real browser and close the "auth pages haven't run in a browser yet" item in `KNOWN_ISSUES.md`.

**Architecture:** Drive the app in the built-in browser (`preview_start` with the `dev` config in `.claude/launch.json`, port 3000). Read the emails from the `devMailbox` table, since `RESEND_API_KEY` is unset. Check state in the browser with `read_page`, cookies with `javascript_tool`, requests with `read_network_requests`.

**Tech Stack:** Convex Auth 2.0.0-beta.0, `@samebase/convex-auth-tanstack-start`, TanStack Start, `bun run dev`.

## Global Constraints

- Test user: `ada@example.com`, a throwaway password generated for the run (min length is enforced; "too common" passwords are rejected). Do not record it in chat.
- Local dev deployment only (`localhost`). Never run against prod.
- Open every emailed link in the **same browser** that requested it (`MISSING_SECRET` otherwise).
- After any sign-in/out the page must be a full load (`location.assign`), not a router navigation.
- Do not commit fixes in this plan; log failures, then fix under systematic-debugging.

## Review Focus

- Open redirect via `?next=` (`//evil.example`, `/\evil.example`, `https://evil.example`).
- Session ending in one tab while another tab is open on a gated page.
- Hydration mismatch warnings on pages rendered as the user (signed-in header vs signed-out).
- Access token expiry (about 1 minute) while idle, then a Convex call.
- Reused or expired verification/reset link.

---

### Task 1: Environment up

- [ ] **Step 1:** From the repo root, check `bun run setup` has been done (`packages/backend/.env.local` exists, auth vars set via `bun run auth:env`). If not, run them.
- [ ] **Step 2:** `preview_start {name: "dev"}`. Expected: tab opens on `http://localhost:3000`, `preview_logs` shows Convex and the web server ready, no errors.
- [ ] **Step 3:** `read_console_messages` on `/`. Expected: no hydration or runtime errors; header shows signed-out links.

### Task 2: Gating and `next` validation (signed out)

- [ ] **Step 1:** Navigate to `/notes`. Expected: server redirect to `/signin?next=%2Fnotes`.
- [ ] **Step 2:** Navigate to `/settings`. Expected: `/signin?next=%2Fsettings`.
- [ ] **Step 3:** Navigate to `/signin?next=//evil.example`, `?next=/\evil.example`, `?next=https://evil.example`. Expected: the param is dropped from the URL for each. (Complete a sign-in later with a hostile `next` and confirm it lands on `/notes`.)

### Task 3: Sign-up and email verification

- [ ] **Step 1:** `/signup`, submit invalid email, then a too-short password, then a common one (`password123`), then one with surrounding whitespace. Expected: the matching message from `MESSAGES` in `apps/web/src/lib/auth.ts` each time, no navigation.
- [ ] **Step 2:** Submit a valid email and password. Expected: a "check your email" state, no session cookie yet (`document.cookie` can't see httpOnly; check via `/notes` still redirecting).
- [ ] **Step 3:** From `packages/backend`: `bunx convex run internal/devMailbox:latest '{"to": "ada@example.com"}'`. Expected: an email with `link` and `code`.
- [ ] **Step 4:** Sign up again with the same email before verifying. Expected: no crash; note the behavior (`EMAIL_TAKEN` only after verification).
- [ ] **Step 5:** Open `link` in the same tab. Expected: "Verifying your email…", then full load of `/notes`, signed in, header shows signed-in state.
- [ ] **Step 6:** Reopen the same link. Expected: "Couldn't verify your email" with the expired/used message, signed-in state unaffected.
- [ ] **Step 7:** Sign out, then sign up with `ada@example.com` again. Expected: `EMAIL_TAKEN` message.

### Task 4: Sign-in, sign-out, session persistence

- [ ] **Step 1:** Wrong password, then unknown email. Expected: both show "Wrong email or password." (no account enumeration).
- [ ] **Step 2:** `/notes` → redirected to `/signin?next=%2Fnotes`; sign in. Expected: lands on `/notes`, content server-rendered (view page source / first paint shows notes, not "Loading…").
- [ ] **Step 3:** Create a note, reload. Expected: note persists, still signed in. `read_network_requests`: `POST /auth/signin` 200, `Set-Cookie` httpOnly (check headers), no refresh token in `localStorage`.
- [ ] **Step 4:** Wait over 60 s idle, then add a note. Expected: works; a `POST /auth/refresh` appears, cookies rotate.
- [ ] **Step 5:** Sign out via the header. Expected: full load of `/`, signed-out header, `/notes` redirects again, cookies cleared.
- [ ] **Step 6:** Rapid failed sign-ins (about 10). Expected: `RATE_LIMITED` message appears.

### Task 5: Multi-tab session end

- [ ] **Step 1:** `tabs_create`, sign in in tab A, open `/notes` in tab B.
- [ ] **Step 2:** Sign out in tab A. Expected: tab B leaves `/notes` for `/signin` without a manual reload (the `RedirectWithoutSession` component), with no error toast loop.

### Task 6: Password reset

- [ ] **Step 1:** `/forgot-password` with an unknown email. Expected: `EMAIL_NOT_FOUND` message (note: this does enumerate accounts; record as a finding if unwanted).
- [ ] **Step 2:** Request reset for `ada@example.com`; read the newest mailbox entry; open `link` in the same tab. Expected: `/reset-password` form.
- [ ] **Step 3:** Submit a weak password, then a valid new one. Expected: weak shows its message; valid signs in and loads `/notes`.
- [ ] **Step 4:** Sign out, sign in with the old password (expect failure) and the new one (expect success).
- [ ] **Step 5:** Reopen the reset link. Expected: expired/used message.
- [ ] **Step 6:** Request a reset in tab A, open the link in a different browser profile or Chrome. Expected: "Open the link in the browser where you requested it."

### Task 7: Responsive and cleanup

- [ ] **Step 1:** `resize_window` mobile on `/signin`, `/signup`, `/notes`. Expected: no horizontal scroll, fields usable. Reset to desktop.
- [ ] **Step 2:** Clear the test data: `bun run convex:reset` (dev deployment only).
- [ ] **Step 3:** Write results (pass/fail per step, console errors, screenshots of failures) to the session. Update the last bullet of `KNOWN_ISSUES.md` ("The auth pages haven't run in a browser yet") to reflect what was verified, and add any new finding as an item.
