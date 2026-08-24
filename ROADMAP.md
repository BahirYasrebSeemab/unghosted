# UnGhosted Build Roadmap

Living plan — source of truth across sessions for **what's decided, what's open, and what's
actually done**. Update it whenever a decision is made or work lands. See `CLAUDE.md` for
current-state architecture notes (though as of this rewrite `CLAUDE.md` itself is stale in places
— see "Docs known to be stale" below).

## Ground truth (updated 2026-08-25 — supersedes everything below dated 2026-08-01)

- The backend is **not** built by a separate team and is **not** external — it's a real Go
  service live in this repo at `apps/api` (chi router, Postgres via `docker-compose.yml`,
  migrations run inline as idempotent `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE ... ADD COLUMN IF
  NOT EXISTS` statements in `apps/api/internal/database/postgres.go` — no separate migration
  tool/files).
- Three frontend packages, not two: `packages/candidate-app` (kiosk + candidate room-join UI —
  still has legacy interviewer-dashboard leftovers not yet pared out), `packages/interviewer-app`
  (company dashboard: create rooms, accept/reject join requests, live monitoring view),
  `packages/admin-web` (**new**, plain browser app, not Electron — platform-admin login/dashboard:
  create companies, top up/reduce balance). `packages/shared` is no longer types-only — it also
  holds `apiClient.ts`, `roomChannel.ts`, `peerManager.ts`, and a shared `VideoRoom.tsx`.
- Auth is two entirely separate systems, on purpose:
  - **Candidates and company staff** log into `users` (JWT access/refresh tokens). A nullable
    `company_role` claim on the JWT distinguishes "just a candidate" from "logged in as part of a
    company" — company membership itself lives on the `Companies` row (`owner`/`admins[]`/`hrs[]`
    email arrays), not a foreign key on `users`.
  - **Platform admins** (who create companies and manage their balances) are a fully separate
    `admins`/`admin_tokens` table with a cookie-based session, checked by `AdminMiddleware`. Not
    self-registered — see `apps/api/cmd/seedadmin` below.
- Rooms are no longer joined by a short "join code" (`DUMM33` was a hardcoded placeholder that's
  now fully retired). A room is joined by its real UUID via an **ask-to-join / accept** flow (see
  below), and is billed in tokens against its owning company's balance.

## What's actually done (as of 2026-08-25)

- **Auth split**: persistent candidate accounts + company accounts share one `users`/JWT system,
  distinguished by `company_role`; admin login is a fully separate cookie-based system, deliberately
  kept (not merged into the JWT system).
- **Admin extracted to its own web app** (`packages/admin-web`) — admin auth is cookie-based,
  which only makes sense in a real browser (native cookie jar), not Electron's main process. CORS
  (`github.com/go-chi/cors`) added to `apps/api`, scoped to `admin-web`'s exact origin
  (`ADMIN_WEB_ORIGIN` env var, default `http://localhost:5175`).
- **Room join redesigned end to end**: candidate pastes a room's real UUID → `GET
  /v1/room/{roomID}` preview (candidate name/role) → `POST .../request-join` → interviewer polls
  and sees an "X is asking to join" banner → `POST .../accept-join` (also starts the billing
  clock, gated on balance — see below) or `.../reject-join` → candidate polls until accepted →
  opens the room's `/ws` session with their normal access token (no separate "room token" concept
  anymore) → interviewer calls `POST .../end` when the interview is over (stops the clock, charges
  tokens). The old `POST /v1/room/join` (by join-code) endpoint never existed server-side and is
  now fully replaced, not just worked around.
- **Company-scoped rooms**: each company only sees its own rooms now (`rooms.company_id`,
  resolved at creation time via a new `GetCompanyByMemberEmail` lookup against
  `Companies.owner/admins/hrs`). This was flatly broken before this pass — `ListRooms` had zero
  filtering and returned every room across every company.
- **Token billing**: 10 tokens per 15 minutes, charged **proportionally** at `end` (not rounded up
  to a full block) based on actual `started_at`→`ended_at` elapsed time. `accept-join` blocks with
  a 403 if the owning company has less than 10 tokens.
- **`apps/api/cmd/seedadmin`**: a CLI to hash+insert (or reset the password of) an admin account
  directly against Postgres — needed because admins aren't self-registered, so a fresh/wiped DB
  has no way to create the first one. `go run ./cmd/seedadmin -email <e> -password <p>` from
  `apps/api`. Along the way, fixed a real bug in the shared `db.NewPostgresPool` `.env` loader: it
  only checked the current directory, so running anything from `apps/api` (whose parent is `apps/`,
  *not* the repo root — two levels up, not one) silently fell through to Postgres defaulting the
  connection to the OS username. Now checks both.

## Deferred / explicitly not done yet

- **HR account login provisioning.** `CompanyService.AddHr`/`AddAdmin` still just append a bare
  name string to `Companies.hrs`/`admins` — no `users` row, no email/password, no real login. Only
  the company *owner* gets a real account today (provisioned in `CreateCompany`). Company-scoping
  and the shared-balance model are already correct for whenever this lands — balance is one int
  per company row, not per-user, so multiple HR logins under one company will naturally share it.
- **Visual redesign.** Current UI across all three apps is a dark, rounded, generic-AI-SaaS look.
  Explicit target (2026-08-24): light navy/white palette, square (not rounded) corners, "real
  dashboard" feel. Scoped as its own dedicated pass — not started. Load `frontend-design` when
  starting it.
- **`IsOwner`/`IsAdmin` in `apps/api/internal/companies/repository.go` are broken** — they call
  `r.DB.Exec` (which doesn't return row data) instead of `QueryRow`/`QueryRow(...).Scan`, and
  unconditionally return `true, err`. Found, not fixed, during the company-scoping work; matters
  once HR/admin role checks actually need to gate anything (`AddHr`'s `isOwner`/`isAdmin` check is
  currently a no-op that always passes).
- **Mac build** — blocked on porting `windowScanner.ts` (Win32-only `koffi`/`user32.dll` calls) to
  a macOS equivalent, plus code-signing/notarization and kiosk-lock re-testing (Cmd+Tab/Mission
  Control are harder to suppress than Windows global shortcuts). Untouched.
- **Monaco code editor, embedded kiosk browser, built-in chat** — untouched, still open.

## Docs known to be stale

- `CLAUDE.md` and `README.md` (last touched 2026-08-01) still describe the pre-monorepo,
  external-Go-team shape — see the "Ground truth" section above for what's actually true. Worth a
  dedicated pass to bring `CLAUDE.md` back in sync (it's the file read into every session's
  context, so its drift is the most costly).
- `CLAUDE.md`'s "Known rough edges" section documents `candidate-app` failing `tsc --noEmit`
  (duplicate `onWindowScan` key, `window.ipcRenderer` bridge-typing issue). **Verified during this
  session that this is no longer true** — `bunx tsc --noEmit` in `packages/candidate-app` now
  exits 0 clean. Someone fixed it since that note was written; the note itself was never updated.
- `REST.md` documents routes (`/v1/create`, `/v1/{roomId}/ws`) that don't match
  `apps/api/internal/router/routes.go`'s real routes (nested under `/v1/room/...`, plus the new
  `request-join`/`accept-join`/`reject-join`/`end` endpoints from this pass). Don't trust it —
  read `routes.go` directly.

## Recommended next task

Two independent threads are ready to start, both unblocked:

1. **HR login provisioning** — give `AddHr` real account creation (mirrors `CreateCompany`'s owner
   provisioning), and fix `IsOwner`/`IsAdmin` while touching that file (they're currently dead
   no-op checks).
2. **Visual redesign** — light navy/white, square corners, across `candidate-app`,
   `interviewer-app`, `admin-web`. Purely additive to the current session's backend work; no
   unknowns blocking it.

Ask which one to start with — no strong dependency either way.

**Note:** as of this rewrite, this session's room/company-scoping/billing work (company scoping,
token billing, join_code retirement, `cmd/seedadmin`, the `.env` loader fix) is **uncommitted** —
`git status` on `dev` shows it as working-tree changes, not yet committed.

## Decisions log

- **2026-08-01** — Backend will be Go, built by a separate team; declined Supabase. *(Superseded
  2026-08-22ish: the Go backend ended up being built in this same repo, at `apps/api`, not by a
  separate team/repo.)*
- **2026-08-01** — One repo, Bun workspaces for interviewer app + candidate app + shared package.
  *(Still true; a third package, `admin-web`, was added later — see 2026-08-24 below.)*
- **2026-08-01** — Multi-tenant SaaS from day one: multiple client companies as orgs, own
  interviewers, data isolated between orgs. *(This was the target from day one but was not
  actually enforced in code until the 2026-08-25 company-scoping fix — `ListRooms` had no
  filtering before that.)*
- **2026-08-01** — Auto-update deferred. Manual installers for now; revisit before real client
  rollout.
- **2026-08-2x** — Auth redesigned: candidate accounts + company accounts share one JWT `users`
  system (`company_role` claim distinguishes them); admin login stays a separate cookie-based
  system on purpose (not merged in), because admin's real UI need turned out to be a browser app,
  not another Electron surface.
- **2026-08-24** — Admin extracted from `interviewer-app` into its own package, `packages/admin-web`
  (plain Vite+React, no Electron) — admin auth is cookie-based, which needs a real browser's
  cookie jar; doing it from Electron's main process required hand-rolling `Set-Cookie`
  capture/replay, which was judged not worth it once the UI need became "an admin needs a web
  page," not "an admin needs a desktop app."
- **2026-08-24/25** — Room joining redesigned from a join-code concept to ask-to-join/accept, using
  the room's real UUID directly (the join-code/link-based-join design from 2026-08-01 was
  explicitly deferred, then superseded by this). Interviewer sees who's asking and can
  accept/reject before the candidate's session opens.
- **2026-08-25** — Company data isolation, real UUID join code (DUMM33 retired), and token billing
  (10 tokens / 15 min, prorated, charged at session end, gated on balance at accept) — all three
  requested together and implemented in one pass. HR login provisioning explicitly deferred in the
  same conversation; visual redesign explicitly split into its own follow-up pass.

## Task checklist (progress tracker)

- [x] Phase 0 scaffolding (Bun workspaces, `packages/{shared,candidate-app,interviewer-app}`)
- [x] Go backend built in-repo at `apps/api` (chi, Postgres, JWT auth, WebSocket signaling hub)
- [x] Candidate + company auth (JWT, `company_role` claim)
- [x] Admin auth (separate cookie-based system) + `packages/admin-web` extraction + CORS
- [x] Room create/list/get, WebSocket signaling hub (`/v1/room/{roomID}/ws`)
- [x] Room join redesign (ask-to-join/accept/reject/end, real UUID, no more join-code)
- [x] Company-scoped room listing (data isolation between companies)
- [x] Token billing (10 tokens/15min prorated, balance gate on accept)
- [x] `cmd/seedadmin` CLI + `.env`-loader path fix
- [ ] HR account login provisioning (`AddHr`/`AddAdmin` real accounts) + fix `IsOwner`/`IsAdmin`
- [ ] Visual redesign (light navy/white, square corners) — all three apps
- [ ] `CLAUDE.md`/`README.md`/`REST.md` refresh pass (currently stale per "Docs known to be stale"
      above)
- [ ] Monaco code editor
- [ ] Embedded kiosk browser
- [ ] Built-in chat
- [ ] Mac build

---

## Appendix: 2026-08-01 scaffolding history (kept for provenance, superseded by "Ground truth" above)

<details>
<summary>Original Phase 0 → scaffolding notes, written before the Go backend moved in-repo</summary>

### Phase 0 — Scaffolding decisions (COMPLETE, 2026-08-01)

- [x] Monorepo vs. two repos → **one repo, Bun workspaces**
- [x] Candidate accounts vs. one-time link → *(originally decided: one-time room link/code only,
  no candidate accounts — superseded 2026-08-2x: candidates now have persistent accounts)*
- [x] Draft API contract now vs. wait for backend team → drafted early; largely superseded once
  the backend moved in-repo and was iterated on directly instead of against a frozen draft
- [x] Multi-tenant vs. single-org → **multi-tenant SaaS from day one**
- [x] Auto-update now vs. defer → **defer**, manual installers until closer to real client rollout

### Original bug-fix notes from the app-split (2026-08-01)

`packages/candidate-app` had post-split `koffi` bundling and `GetWindowTextW` scope bugs, both
fixed the same day (see git history around that date for specifics — not reproduced here since
they're resolved and this section is provenance-only).

</details>
