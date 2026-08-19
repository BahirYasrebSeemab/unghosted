# UnGhosted API Contract — draft for backend team

Status: **draft, not yet confirmed with backend team.** This is a starting spec for the Go backend
(see `ROADMAP.md` for the decisions this is built on: multi-tenant orgs, interviewer-only accounts,
candidates join via one-time room link/code with no signup, room-based session model). Change
freely — the frontend (`packages/interviewer-app`, `packages/candidate-app`) will adapt to whatever
you actually ship; treat field names/paths here as a proposal, not a contract either side is locked into yet.

Conventions assumed below: JSON over HTTPS, JWT bearer auth (`Authorization: Bearer <token>`) for
interviewer endpoints, a separate short-lived room token for candidate endpoints, timestamps as
ISO 8601 UTC strings, ids as UUIDs (swap for your preferred id scheme freely).

## Auth (interviewer only — candidates never get accounts)

```
POST   /v1/auth/register          { email, password, name, orgName? }  -> { user, org, accessToken, refreshToken }
POST   /v1/auth/login              { email, password }                  -> { user, org, accessToken, refreshToken }
POST   /v1/auth/refresh            { refreshToken }                     -> { accessToken, refreshToken }
POST   /v1/auth/logout             { refreshToken }                     -> 204
GET    /v1/auth/me                 (bearer)                             -> { user, org }
POST   /v1/auth/forgot-password    { email }                            -> 202
POST   /v1/auth/reset-password     { token, newPassword }               -> 204
```

`user`: `{ id, email, name, orgId, role }` — `role` at least `owner | interviewer` to start (owner
can invite/manage the org).

## Orgs (multi-tenant)

```
GET    /v1/orgs/me                 (bearer)                             -> { id, name, plan, createdAt }
PATCH  /v1/orgs/me                 { name? }                            -> org
GET    /v1/orgs/me/members         (bearer)                             -> [user]
POST   /v1/orgs/me/invite          { email, role }                      -> { inviteId } (sends invite email; invited user completes via /auth/register with the invite token, or a dedicated /auth/accept-invite)
DELETE /v1/orgs/me/members/:userId (bearer, owner only)                 -> 204
```

All room/session data below is implicitly scoped to `orgId` from the bearer token — a request must
never be able to read another org's rooms.

## Rooms (the session/interview unit)

A **room** = one interview instance. Interviewer creates it, optionally schedules it, generates a
join link/code, candidate uses that to enter — no candidate account ever exists.

```
POST   /v1/rooms                   { candidateName, role, scheduledAt? }        -> room
GET    /v1/rooms                   ?status=scheduled|active|ended&cursor=...    -> [room]
GET    /v1/rooms/:roomId           (bearer, interviewer must own/belong to org) -> room
PATCH  /v1/rooms/:roomId           { status?, candidateName?, role? }           -> room
POST   /v1/rooms/:roomId/invite    {}                                          -> { joinUrl, joinCode, expiresAt }
POST   /v1/rooms/:roomId/end       {}                                          -> room  (status -> ended, closes any open ws connections)
GET    /v1/rooms/:roomId/report    (bearer)                                    -> { riskScore, eventCounts, timeline, ... } (final summary/export)
```

`room`: `{ id, orgId, createdBy, candidateName, role, status: "scheduled"|"active"|"ended", joinCode, createdAt, startedAt?, endedAt? }`

### Candidate join (no account — token-based)

```
POST   /v1/rooms/join              { joinCode }             -> { roomToken, room: { id, candidateName, role } }
```

`roomToken` is a short-lived JWT scoped to exactly that room, used as the candidate app's bearer
token for the WS connection and any REST calls below. It should be invalidated when the room ends.

## Realtime stream (event log, risk score, monitor status, chat)

One WebSocket per room, both interviewer app and candidate app connect to the same room channel
with their respective tokens (interviewer's normal JWT vs. the candidate's `roomToken`) and
different permissions (candidate app is a stricter producer than a consumer, no reason to expose it
the interviewer's controls).

```
WS /v1/rooms/:roomId/stream
```

Message envelope (both directions): `{ type: string, payload: object, ts: string }`

Candidate app -> server -> interviewer app:
```
{ type: "event",         payload: { category, message, severity } }        // TAB/FOCUS/MOUSE/CLIPBOARD/KEYBOARD/AUDIO/GAZE/PROCESS — matches src/App.tsx's existing categories
{ type: "monitor_status", payload: { key, status, value, count } }
{ type: "risk_score",     payload: { score } }
```

Interviewer app -> server -> candidate app:
```
{ type: "room_control", payload: { action: "end_session" } }
```

Both directions (chat, see below):
```
{ type: "chat_message", payload: { id, senderRole: "interviewer"|"candidate", text?, fileId?, ts } }
```

## Code editor

```
POST   /v1/rooms/:roomId/code      { content, language }    -> { savedAt }   (autosave, debounce client-side)
GET    /v1/rooms/:roomId/code      (bearer or roomToken)     -> { content, language, updatedAt }
```
If code execution is ever added, that should be a separate sandboxed-runner endpoint
(`POST /v1/execute` or similar, hitting an isolated runner — not something the candidate's locked-down
machine executes locally) — deliberately not speccing that yet since it's still open.

## Chat / files

```
GET    /v1/rooms/:roomId/messages           ?cursor=...     -> [message]   (history; live delivery is via WS chat_message above)
POST   /v1/rooms/:roomId/files               multipart       -> { fileId, url, name, size, contentType }
GET    /v1/files/:fileId                     (bearer or roomToken, must belong to same room)  -> file bytes / signed redirect
```

Recommend the backend enforce an allow-list of `contentType` (text/code/image/pdf) and a size cap
at upload time — the client should never be the only thing enforcing that.

## Open items for the backend team to weigh in on

- Exact token/claims format (JWT vs. opaque + introspection) — frontend just needs *a* bearer token, no strong opinion.
- Whether room join codes are human-typeable (e.g. 6-char code) in addition to a full URL — candidate app UX wants both ("click the link" and "type the code" as a fallback).
- Rate limiting on `/v1/rooms/join` (join codes are guessable if short — needs either sufficient entropy or attempt limiting).
- Whether `GET /v1/rooms` needs pagination cursors from day one (interview volume is probably low enough early on that offset paging is fine too).
