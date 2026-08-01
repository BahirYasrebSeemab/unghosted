# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

UnGhosted is an Electron + React desktop app that acts as an interview-proctoring / anti-cheating monitor. It runs a candidate-facing kiosk window during a live technical interview and watches for signs of AI-assisted or otherwise dishonest behavior (tab/window switching, clipboard pastes, keystroke-burst patterns suggesting pasted code, gaze/attention drift via webcam, voice activity, and OS-level windows that hide themselves from screen capture — e.g. "GhostGPT"-style overlay tools).

The package manager is **Bun**, and as of the interviewer/candidate split this is a **Bun workspaces monorepo** (`bun.lock` at root covers all packages; `koffi` is a `trustedDependencies` entry requiring Bun's postinstall trust step).

## Repo layout — two apps, one workspace

This repo now contains **two separately-built, separately-installed Electron apps** plus a shared package, under `packages/`:

- **`packages/candidate-app`** — the original app, relocated as-is. This is the kiosk surface the candidate sits inside: signal collection (webcam/gaze, audio, clipboard, keyboard cadence, window scanning), kiosk-mode lock. **Currently still contains the interviewer-dashboard UI too** (risk gauge, monitor cards, event log) — it has not yet been pared down to kiosk-only; that's future work, see `ROADMAP.md`.
- **`packages/interviewer-app`** — new, minimal placeholder shell (no kiosk lock, no window-scan IPC). The real dashboard UI still needs to move here from `candidate-app`.
- **`packages/shared`** (`@unghosted/shared`) — cross-app TypeScript types only so far: the monitoring vocabulary (`Severity`, `AlertEvent`, `MonitorState`, `Monitors`, `FlaggedWindow`) and the draft WS room-stream message shapes (`RoomStreamMessage`, `Room`). The actual detection *logic* has **not** been extracted yet — it's still inline in `candidate-app/src/App.tsx`'s `useEffect`s.

Each app has its own `package.json`, `vite.config.ts`, `tsconfig*.json`, `electron-builder.json5` (distinct `productName`/`appId` — `UnGhosted Candidate` / `UnGhosted Interviewer`), `electron/` and `src/` — same vite-plugin-electron pattern in both. See `ROADMAP.md` for what's done vs. planned, and `docs/API_CONTRACT.md` for the draft REST/WS contract handed to the Go backend team (backend is being built in Go by a separate team, not in this repo, and not on any BaaS — see `ROADMAP.md`'s "Ground truth").

## Commands

Run from repo root, targeting a specific package (`candidate` or `interviewer`):

```
bun install             # install deps for all workspace packages (uses bun.lock)
bun run dev:candidate   # vite dev server + electron in dev mode for the candidate app
bun run dev:interviewer # same, for the interviewer app
bun run build:candidate     # tsc typecheck -> vite build -> electron-builder packaging
bun run build:interviewer
bun run lint:candidate
bun run lint:interviewer
```

Or `cd packages/<app>` and use its local `dev`/`build`/`lint`/`preview` scripts directly.

There is no test suite/runner configured in this repo.

`build:*` runs a real `tsc` typecheck before bundling — treat lint and the build's typecheck as the two correctness gates when changing anything under a package's `src/` or `electron/`. **`packages/candidate-app` does not currently pass `tsc --noEmit` clean** (pre-existing, not introduced by the workspace split — see "Known rough edges" below and `ROADMAP.md`'s scaffolding notes for the specific errors). `packages/interviewer-app` typechecks and builds clean as of the split.

## Architecture (per-app)

Each app is a **vite-plugin-electron** app with three separate TypeScript worlds that don't share a module graph — always check which world a file belongs to before assuming an import will resolve:

- **`electron/`** — Node.js main + preload processes (compiled by `vite-plugin-electron`, not by the renderer's Vite pipeline).
  - **candidate-app** `main.ts` — creates the kiosk `BrowserWindow`, owns all OS-level integration: kiosk mode + global-shortcut locking, the `desktopCapturer`/`setDisplayMediaRequestHandler` override that auto-selects the primary screen for screen-share (no picker, since the candidate should not choose what's shared), and a `setInterval` poll (every 3s) that calls `scanWindows()` and pushes results to the renderer over `window-scan` / `window-scan-status` IPC channels.
  - **candidate-app** `windowScanner.ts` — uses `koffi` to call raw Win32 `user32.dll` functions (`EnumWindows`, `GetWindowDisplayAffinity`, `GetWindowTextW`, etc.) directly from Node, with no native addon compilation step. It flags windows that either (a) match a name in `BLACK_LISTED_NAMES` (currently `metop vpn mini`, `ghostgpt`), or (b) have `WDA_EXCLUDEFROMCAPTURE`/`WDA_MONITOR` display affinity set — the Windows API flag overlay-cheating tools use to hide themselves from screen recordings/shares. **This is Windows-only** (loads `user32.dll` unconditionally); there is no macOS/Linux equivalent implemented — this is the specific piece that blocks a Mac build (see `ROADMAP.md`).
  - **interviewer-app** `main.ts` — plain desktop window, no kiosk lock, no window scanning, no disabled shortcuts. It's the dashboard/control surface, not the proctored surface.
  - `preload.ts` (both apps) — the only bridge between the two worlds, via `contextBridge.exposeInMainWorld('ipcRenderer', ...)`. Anything the renderer needs from Electron/Node must be added here explicitly and typed in that app's `electron/electron-api.d.ts` — adding an IPC channel means touching `main.ts` (handler), `preload.ts` (bridge method), and `electron-api.d.ts` (types) together, per app.

- **`src/`** — the renderer (React 18 + Tailwind v4, via `@tailwindcss/vite`), bundled by Vite normally.
  - **candidate-app** `App.tsx` is a single large component tree holding almost all app state and behavioral-monitoring logic (no external state library) — still includes the dashboard UI too, not yet split out. Each signal is its own `useEffect` wired to a browser API: `visibilitychange` (tab switch), `window` blur/focus, `mouseleave`/`mouseenter`, `copy`/`paste`, `keydown` cadence timing, and IPC listeners (`onWindowScan`, `onWindowScanStatus`) for the main-process window scan. All of these funnel through one `addEvent(category, message, severity)` callback that appends to the event log, bumps a 0–100 `riskScore`, and updates the relevant `Monitors` card — this is the central place to hook in a new detection signal. No network calls exist here yet (no `fetch`) — `SESSION_ID`/`CANDIDATE`/`ROLE` are still hardcoded constants, not wired to the real room/auth flow in `docs/API_CONTRACT.md`.
  - **candidate-app** `concentrationMonitor.ts` (`ConcentrationMonitor` class) is self-contained and framework-agnostic — it owns the MediaPipe `FaceLandmarker` lifecycle against a given `<video>` element, computes gaze deviation / head pose / blink-based EAR, and reports a smoothed `ConcentrationReading` (score + `focused | distracted | away | drowsy` state) via `onUpdate()`. It optionally renders its own overlay DOM node, but `App.tsx` mounts it with `mountOverlayTo: null` and instead derives its own crosshair/monitor-card UI from the `ConcentrationReading` — don't reintroduce the built-in overlay unless intentionally bypassing that.
  - A session (`startSession`/`stopSession`) both flips local monitoring state *and* round-trips to main via IPC (`startSessionScan`, `enterKioskMode`/`exitKioskMode`) — the renderer and main process each hold half of "is a session active," so new session-scoped behavior usually needs changes on both sides.
  - **interviewer-app** `App.tsx` is currently just a placeholder screen — the real dashboard hasn't been built/moved here yet.

## Known rough edges

- `packages/candidate-app` does not typecheck clean (pre-existing, confirmed via `git diff --stat` showing the workspace-move commit as pure renames with 0 content changes — not caused by the split):
  - `electron/electron-api.d.ts` declares the `onWindowScan` key twice (duplicate object member).
  - `src/App.tsx` fails to typecheck `window.ipcRenderer.onWindowScan`/`.onWindowScanStatus`/`.startSessionScan`/`.enterKioskMode`/`.exitKioskMode` — TS appears to resolve `window.ipcRenderer` to Electron's built-in `IpcRenderer` type rather than the augmented `Window` interface from `electron-api.d.ts` (possibly `vite-plugin-electron-renderer`'s own type polyfill shadowing the global augmentation) — works at runtime, fails `tsc --noEmit`.
  - `electron/main.ts`'s `enterKioskMode`/`exitKioskMode` functions currently have mismatched braces (the function bodies run together without a closing brace before the next `function` declaration), plus several "possibly null" `win` accesses and unused imports — this reflects the repo's in-progress state (see `TODO.md` and recent commit history titled "BROKEN", "ALMOST BROKEN", etc.). Check this file compiles before assuming kiosk-mode entry/exit works as written.
  - `electron/windowScanner.ts` references `GetWindowTextW` before it's in scope inside `getWindowTitleSafe`.
- Kiosk mode (candidate-app) disables the normal window chrome and unregisters most close/quit shortcuts (`Alt+F4`, `Ctrl+W`, `Ctrl+R`, `F11`, `Escape` are all bound to no-ops); only `Ctrl+Shift+Q` quits. Be deliberate when touching this — it's what keeps the candidate inside the proctored session, and a mistake here can make the dev window unexitable via normal means.
- A stray root-level file named `wl-copy` (tracked in git) contains what looks like an accidental dump of old `App.tsx` content, unrelated to its Wayland-clipboard-tool name — not touched during the workspace split; flag before assuming it's meaningful.
- `packages/candidate-app/vite.config.ts` explicitly externals `koffi` and `systeminformation` from the main-process Rollup build (`main.vite.build.rollupOptions.external`). Without this, Rollup inlines koffi's source into `dist-electron/main.js`, which breaks koffi's own runtime lookup of its prebuilt native `.node` binary (that lookup is relative to koffi's real package directory via `import.meta.dirname`, not wherever the bundle ends up) — throws `Cannot find the native Koffi module` on every launch. Keep any other native/binary-loading dependency external too if one gets added here.
