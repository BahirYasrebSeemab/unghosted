# UnGhosted Build Roadmap

Living plan for the items in `TODO.md`. This file is the source of truth across sessions for
**what's decided, what's open, and what's actually done** — update it whenever a decision is made
or work lands, don't let it go stale. See `CLAUDE.md` for current-state architecture notes.

## Ground truth

- Backend is being built in **Go by a separate backend team** — not built in this repo, not Supabase.
- Backend model is **"rooms"**: interviewer creates a room, candidate joins it. Exact wire format
  (REST/WS shapes, token format) not yet defined as of 2026-08-01.
- Target: **two separately-built, separately-installed Electron apps** — interviewer app and
  candidate app — instead of today's single app that does both.

## Phase 0 — Scaffolding decisions (COMPLETE, 2026-08-01)

- [x] Monorepo vs. two repos → **one repo, Bun workspaces**
- [x] Candidate accounts vs. one-time link → **one-time room link/code only, no candidate accounts**
- [x] Draft API contract now vs. wait for backend team → **draft it now, hand to backend team as a starting spec**
- [x] Multi-tenant vs. single-org → **multi-tenant SaaS from day one** (multiple client companies, each an org, own interviewers, data isolated between orgs)
- [x] Auto-update now vs. defer → **defer**, manual installers until closer to real client rollout

## Phase list (not yet started unless noted)

1. **Scaffolding** — repo/workspace structure, two app shells, shared package. *(Phase 0 questions block this.)*
2. **Auth** — login UI + integration once Go backend auth endpoints exist. Endpoint list already drafted (see Decisions log 2026-08-01) and ready to hand to backend team.
3. **UI redesign** — not backend-dependent, can happen anytime. Current UI reads as generic dark-SaaS-template (emoji icons, corner-bracket decorations, default emerald/amber/red triad). Use `frontend-design` skill when doing this.
4. **Builtin code editor (Monaco)** — not backend-dependent besides autosave endpoint; can be prototyped in the current single app.
5. **Embedded browser in kiosk (WebContentsView)** — needs a product decision first: restricted allow-list browsing vs. open sandboxed browsing.
6. **Builtin chat** — needs backend (messages/files endpoints) + auth first.
7. **Mac build** — do after core features stabilize on Windows. Blocked specifically on: porting `windowScanner.ts` (Win32-only) to macOS equivalent, code-signing/notarization setup, and re-testing kiosk-lock behavior (Cmd+Tab/Mission Control are harder to suppress than Windows global shortcuts).

## Decisions log

- **2026-08-01** — Backend will be Go, built by a separate team; declined Supabase.
- **2026-08-01** — Starting point for implementation work: two-app split scaffolding (over UI redesign or code editor).
- **2026-08-01** — Draft endpoint list proposed for backend team (auth, orgs, sessions/rooms, events stream, code, chat/files) — see conversation history / CLAUDE.md; not yet finalized against the Go team's actual "rooms" design.
- **2026-08-01** — One repo, Bun workspaces (not two separate repos) for interviewer app + candidate app + shared package.
- **2026-08-01** — Claude will draft a concrete API/WS contract now (not wait for backend team's own design) — starting spec for the Go team to build against.
- **2026-08-01** — Multi-tenant SaaS from day one: multiple client companies as orgs, each with their own interviewers, data isolated between orgs. Matches TODO.md's "find real clients" goal — this is a product being sold to multiple companies, not an internal tool.
- **2026-08-01** — Auto-update deferred. Manual installers for now; revisit before real client rollout.
- **2026-08-01** — Phase 0 complete. Proceeding to: draft API/WS contract doc, then scaffold the Bun-workspaces monorepo (packages/shared, packages/interviewer-app, packages/candidate-app).

## Task checklist (progress tracker)

- [x] Phase 0 questions answered
- [x] Workspace/repo structure created — Bun workspaces, `packages/{shared,candidate-app,interviewer-app}`
- [x] `packages/shared` extracted — **types only so far** (monitoring vocabulary, room-stream WS message shapes). The actual detection *logic* still lives inline in `packages/candidate-app/src/App.tsx`'s `useEffect`s — not yet moved out. Do that when the candidate-app UI gets pared down to kiosk-only.
- [x] Interviewer app shell — `packages/interviewer-app`, own `main.ts`/`preload.ts`/electron-builder config (`UnGhosted Interviewer`, no kiosk lock, no window-scan IPC), placeholder React screen. Typechecks clean, `vite build` verified.
- [x] Candidate app shell — existing app relocated intact to `packages/candidate-app` (`UnGhosted Candidate` productName/appId). All content byte-identical to pre-move (verified via `git diff --stat`), so no regressions introduced by the move. `vite build` verified.
- [x] API contract doc drafted — `docs/API_CONTRACT.md`, ready to hand to the Go backend team (still a draft/proposal, not confirmed with them)
- [ ] Auth UI (interviewer login, candidate room-join) — blocked on backend team publishing real endpoints/response shapes
- [ ] API contract finalized with backend team (their sign-off / revisions)
- [ ] UI redesign
- [ ] Monaco code editor
- [ ] Embedded kiosk browser
- [ ] Builtin chat
- [ ] Mac build

### Known issue found during scaffolding (pre-existing, not introduced by the move)

`packages/candidate-app` (the old root app) does **not** currently pass `tsc --noEmit` clean —
confirmed pre-existing (moved files are byte-identical to the prior committed content, 0
insertions/deletions per `git diff --stat`). Notable ones:
- `electron/electron-api.d.ts` declares the `onWindowScan` key twice (duplicate object member).
- `src/App.tsx` errors on `window.ipcRenderer.onWindowScan/.onWindowScanStatus/.startSessionScan/.enterKioskMode/.exitKioskMode` — TS resolves `window.ipcRenderer` to Electron's built-in `IpcRenderer` type rather than the augmented `Window` interface from `electron-api.d.ts`, so the custom bridge methods don't typecheck even though they work at runtime (vite-plugin-electron-renderer's own type polyfill likely shadows the global augmentation — needs investigation).
- `electron/main.ts` has several "possibly null" `win` accesses and unused imports.
- `electron/windowScanner.ts` references `GetWindowTextW` before it's in scope in `getWindowTitleSafe`.

Matches the "BROKEN"/"ALMOST BROKEN" commit history and CLAUDE.md's documented kiosk brace-mismatch
rough edge — this repo was already mid-repair before the split. Not fixed as part of scaffolding
(out of scope for a pure move); flag for a dedicated bugfix pass. `packages/interviewer-app`
(freshly written) typechecks and builds clean.

### Bug found + fixed while first-running candidate-app post-split (2026-08-01)

Running `bun run dev:candidate` threw `Error: Cannot find the native Koffi module; did you bundle
it correctly?` on launch. Root cause: Vite/Rollup was inlining koffi's own source into
`dist-electron/main.js` instead of leaving it as an external `require`/`import`. koffi locates its
prebuilt native `.node` binary via a path relative to **its own package directory** at runtime
(`import.meta.dirname` inside koffi's code) — once its source is bundled into `dist-electron/`,
that lookup resolves relative to `dist-electron/` instead of koffi's real install location, so it
never finds the binary (which is installed correctly — verified directly with plain `node -e
"require('koffi')"`, which works fine).

This is **not caused by the workspace split** — it would have failed identically in the original
single-app layout the moment `main.ts`'s import of `windowScanner.ts` (and therefore `koffi`) was
bundled the same way; it's about Rollup's default bundling behavior for the Electron main process,
unrelated to directory depth. Likely why the repo's commit history has "BROKEN"/"ALMOST BROKEN"
commits — this may be one of them.

**Fix:** added `external: ['koffi', 'systeminformation']` to `packages/candidate-app/vite.config.ts`'s
main-process Rollup config, so both stay as plain runtime imports instead of being bundled.
Verified: `dist-electron/main.js` now contains `import u from "koffi"` (5KB) instead of koffi's
full inlined source (16KB), and `bun run dev` no longer crashes on load.

### Second bug found + fixed on the next run (2026-08-01)

With the above fixed, the app launched but then crashed ~3s later (when the window-scan timer
first fired): `ReferenceError: GetWindowTextW is not defined` in `getWindowTitleSafe`. This is
the exact issue already flagged above under "pre-existing tsc errors" (`electron/windowScanner.ts`
references `GetWindowTextW` before it's in scope) — `getWindowTitleSafe` was a module-level
function reading `GetWindowTextW`, but `GetWindowTextW` only exists as a local `const` inside
`scanWindows()`. `tsc` would have caught this (TS2304), but `dev` mode doesn't run the typecheck
gate, so it shipped as a silent runtime crash instead.

**Fix:** moved `getWindowTitleSafe` to be a closure defined inside `scanWindows()`, after
`GetWindowTextW` is bound, instead of a module-level function. `tsc --noEmit` no longer reports
that error, and the build is clean.

**Takeaway:** `candidate-app` was accumulating real, previously-undetected runtime bugs that only
surfaced once someone actually ran it — the "pre-existing tsc errors" list above isn't just
noise, each one is worth walking through and fixing, not only the two that happened to crash
first. Recommend a dedicated pass through the remaining ones (duplicate `onWindowScan` key,
`window.ipcRenderer` bridge-method typing, `main.ts`'s null-`win` accesses) before relying on this
app further, rather than waiting to hit each one at runtime.
