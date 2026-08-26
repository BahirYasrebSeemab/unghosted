# TODO

See `ROADMAP.md` for the full picture (what's decided, what's done, why) — this file is just the
flat task list. Last swept 2026-08-25.

## Done (this pass, 2026-08-25 — see ROADMAP.md "What's actually done")
- [x] Interviewer auth (JWT, `company_role`)
- [x] Company logic — scoping (rooms now isolated per company), balance model
- [x] insert jwt in to headers / auth middleware
- [x] Websocket connection between the two (signaling hub, room join now gated by accept)
- [x] id to real-uuid way of transformation for rooms (DUMM33 join_code retired)

## Open

- Fix websockets: video comes only when interviewer reconnects with candidate inside the room
- Spend tokens: back-end logic + db row
- Room logic completion: close the room after timeout with no users + update db

## Interviewer UI
Dashboard exists (create room, accept/reject join requests, live view) — not yet the "user
dashboard inside the software to show what interviews and where they had" summary view below.

## Better looking and feeling UI
Explicit target now: light navy/white, square (not rounded) buttons — see ROADMAP.md. Not started.

### HR account login provisioning
`AddHr`/`AddAdmin` only append a name string today, no real account. See ROADMAP.md "Deferred".
Also fix `IsOwner`/`IsAdmin` in `companies/repository.go` while touching that file — currently
broken no-ops (always return true).

### Add Zod schemas for all API things

## Builtin code editor instead of external vs code
Check performance

## Collect data for Yasins model

## Blocking any external apps (I'm still thinking if I can close other apps from electron)

## Builtin chat to send files, instead of telegram or some WhatsApp

##  Build for mac

## Write good readme
CLAUDE.md/README.md/REST.md are stale — see ROADMAP.md "Docs known to be stale" for specifics.

## Landing Website

## User dashboard inside the software to show what interviews and where they had

##  Find real clients for UnGhosted
Founders school should help with that, but cold emails can go now


# Stuff we don't have for scalability
- Pagination
- Duplicate room verification
- Interview as a separate entity that gets attached to room
- (?) JWT access tokens Postgres -> Redis
