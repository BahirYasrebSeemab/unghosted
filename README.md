# UnGhosted

UnGhosted is a desktop interview-proctoring / anti-cheating monitor. During a live technical
interview it watches for signs of AI-assisted or otherwise dishonest behavior — tab/window
switching, clipboard pastes, keystroke-burst patterns suggesting pasted code, gaze/attention drift
via webcam, voice activity, and OS-level windows that hide themselves from screen capture (e.g.
"GhostGPT"-style overlay tools).

## What's in this repo

This is a **Bun workspaces monorepo** containing two separately-built, separately-installed
Electron apps, plus a shared package:

```
packages/
├── candidate-app/     the kiosk surface the candidate sits inside during a session
├── interviewer-app/   the interviewer's dashboard/control surface
└── shared/            (@unghosted/shared) types shared between the two apps
```

**Why two apps instead of one:** the interviewer and the candidate are on different machines with
very different needs. The candidate app locks into kiosk mode and does the actual signal
collection; the interviewer app is a normal window that watches the results. They're built and
installed independently. See `ROADMAP.md` for the full reasoning and what's still open.

**Current status:** the two-app split is scaffolded, but not finished. `candidate-app` is the
original single-app implementation relocated as-is — it still contains the interviewer-dashboard
UI (risk gauge, monitor cards, event log) that hasn't been pulled out into `interviewer-app` yet.
`interviewer-app` is currently just a placeholder screen. There is no backend yet — auth, rooms,
and the live event stream all depend on a Go backend a separate team is building; see
`docs/API_CONTRACT.md` for the draft contract, and `ROADMAP.md` for what's decided vs. still open.
Check `ROADMAP.md` before assuming anything below the "scaffolding" layer is done.

## Setup

Package manager is **Bun**.

```
bun install
```

`koffi` (used by `candidate-app` for Windows window-scanning) is a native dependency listed in
`trustedDependencies`, so Bun will run its install script automatically.

## Running the apps

From the repo root:

```
bun run dev:candidate       # candidate/kiosk app, dev mode with hot reload
bun run dev:interviewer     # interviewer app, dev mode with hot reload
```

Or from inside a package directory (`packages/candidate-app` or `packages/interviewer-app`):

```
bun run dev        # vite dev server + electron
bun run build       # tsc typecheck -> vite build -> electron-builder packaging
bun run lint
bun run preview     # renderer only, no electron shell
```

`build` is the one that packages an actual installer (via electron-builder) — `dev` just runs the
app locally and doesn't need a typecheck to pass first.

**Known issue:** `candidate-app` does not currently pass `tsc --noEmit` cleanly (pre-existing —
confirmed unrelated to the workspace split, see `CLAUDE.md`'s "Known rough edges"). This does not
block `dev`, only `build`.

## Platform support

Built and tested on **Windows** so far. `candidate-app`'s window-scanning feature
(`electron/windowScanner.ts`, the part that detects hidden/overlay windows like GhostGPT-style
tools) calls raw Win32 APIs directly and is **Windows-only** — it's a no-op import failure on
macOS/Linux as written. Everything else (UI, auth, code editor, kiosk lock via Electron's own
cross-platform APIs) is portable; see `ROADMAP.md`'s Mac-feasibility notes for what porting
window-scanning would take.

## Where to look next

- **`ROADMAP.md`** — the living plan: what's decided, what's still open, what's actually done. Read this first before starting new work on the app split, auth, or any of the other TODO items.
- **`docs/API_CONTRACT.md`** — draft REST/WebSocket contract for the Go backend team (auth, orgs, rooms, live event stream, code editor autosave, chat/files). Not yet confirmed with them.
- **`CLAUDE.md`** — architecture notes: per-app module structure, the Electron main/preload/renderer split, and known rough edges/bugs.
- **`TODO.md`** — the original short-form task list this roadmap was built from.
