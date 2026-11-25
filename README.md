# UnGhosted

**A desktop proctoring app for live technical interviews.** The candidate works inside a locked-down
Electron app that watches for signs of AI help: window and tab switching, clipboard pastes,
keystroke bursts that look like pasted code, gaze drift on the webcam, voice activity, and OS windows
that hide themselves from screen capture (the "invisible overlay" cheating tools). The interviewer
sees the live video call and a risk feed in their own app.

> Team project, built by three developers in summer 2026. This is my public copy of our shared
> repository (secrets removed from history). Status: working prototype, not a finished product.

## What's in here

```
apps/
  api/                 Go backend: auth, companies, admins, rooms, WebRTC signaling, chat (PostgreSQL)
packages/
  candidate-app/       Electron + React: the kiosk the candidate sits in, collects the signals
  interviewer-app/     Electron + React: the interviewer's dashboard and video call
  admin-web/           React (Vite) web app: company and admin management
  shared/              Types, room channel and WebRTC hooks shared by both desktop apps
docs/API_CONTRACT.md   REST + WebSocket contract between the apps and the API
```

**Stack:** TypeScript · React · Electron · Vite · Bun workspaces · Go · PostgreSQL · WebRTC (TURN/STUN) ·
WebSockets · koffi (native Win32 calls for window scanning)

## How it works

1. A company admin creates an interview room (admin web → Go API).
2. The interviewer opens the room in the interviewer app; the candidate joins with a code in the
   candidate app, which switches to kiosk mode.
3. The two apps open a WebRTC video call. Signaling (offer, answer, ICE candidates) goes through the
   Go API's WebSocket; media goes peer to peer, relayed over TURN when NAT requires it.
4. The candidate app streams monitoring events to the interviewer, who sees them as a risk gauge
   and an event log.

## My part (Bahir Yasreb Seemab)

- **Monorepo split:** turned the original single Electron app into separate candidate and
  interviewer apps plus a shared package (Bun workspaces), and wrote the API contract the Go
  backend was built against. Fixed two bugs found on the first run after the split: the native
  `koffi` module being bundled instead of kept external, and a Win32 `GetWindowTextW` scope bug.
- **Backend:** authentication for interviewers and companies, the rooms table and room-joining
  endpoints in the Go API, CORS support, and moving the admin UI into its own web app.
- **Live video debugging:** the call connected but video never arrived. The cause was a race: the
  `RTCPeerConnection` was created before the TURN credentials finished loading, and a connection's
  ICE servers are fixed when it is created, so it silently stayed on STUN only. Fixed by waiting
  for the credentials (which always settle quickly, with a STUN fallback) before creating the
  connection. Also fixed a signaling "glare" crash when both sides sent offers at once, and a
  duplicate signaling socket in the interviewer app.

Teammates: [Fa1tinthesky](https://github.com/Fa1tinthesky) (original candidate app, monitoring
signals, signaling) and [Noskash](https://github.com/Noskash) (admin panel backend, WebSockets).

## Run it

Needs [Bun](https://bun.sh), Go 1.26+, and PostgreSQL.

```bash
bun install

# API
cp apps/api/.env.example apps/api/cmd/server/.env   # then fill in
cd apps/api && go run ./cmd/seedadmin && go run ./cmd/server

# Apps (from the repo root, each in its own terminal)
cp packages/candidate-app/.env.example packages/candidate-app/.env
cp packages/interviewer-app/.env.example packages/interviewer-app/.env
bun run dev:interviewer
bun run dev:candidate
bun run dev:admin
```

`bun run build:candidate` (and `build:interviewer`) packages an installer with electron-builder.

## Limits

- Window scanning for hidden overlay windows calls Win32 directly, so it works on **Windows only**;
  the rest of the apps are cross-platform.
- `candidate-app` does not pass `tsc --noEmit` cleanly yet (this blocks `build`, not `dev`).
- See `ROADMAP.md` for what is decided, what is open, and what is done.
