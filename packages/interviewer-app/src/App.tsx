import { useCallback, useEffect, useMemo, useState } from "react"
import type { BackendRoom, RoomChannelMessage, AlertEvent, Severity } from "@unghosted/shared"
import { RoomChannel, VideoRoom, Button, Input, Card, Badge, RiskGauge, EventLog } from "@unghosted/shared"
import * as api from "../../shared/src/apiClient";

// The WS URL is derived from this same origin (http(s) -> ws(s)) inside RoomChannel/VideoRoom —
// see packages/shared/src/roomChannel.ts's header comment for why there's no separate WS env var.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json).sub ?? null
  } catch {
    return null
  }
}

// This app is for company accounts only — an empty company_role means the account is a plain
// candidate (see apps/api's auth/service.go, which stamps that claim at login/refresh time).
function decodeCompanyRole(token: string): string {
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json).company_role ?? ""
  } catch {
    return ""
  }
}

type RoomStatus = "scheduled" | "active" | "ended"

// The one recurring device this app is built around: a tally light, the on-air indicator on a
// broadcast camera. A room is either off (scheduled), live (active), or done (ended) — and once
// you're watching a live feed, the same dot tracks risk instead (signal → warning → critical).
function StatusDot({ tone, pulse }: { tone: "signal" | "warning" | "critical" | "off"; pulse?: boolean }) {
  const color =
    tone === "signal" ? "bg-[var(--color-signal)]" : tone === "warning" ? "bg-[var(--color-warning)]" : tone === "critical" ? "bg-[var(--color-critical)]" : "bg-muted-foreground"
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-60 animate-ping`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  )
}

function statusTone(status: RoomStatus): "signal" | "warning" | "critical" | "off" {
  return status === "active" ? "signal" : status === "ended" ? "off" : "off"
}

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [companyRole, setCompanyRole] = useState<string>("")
  const [selectedRoom, setSelectedRoom] = useState<BackendRoom | null>(null)

  const handleLogin = useCallback((token: string) => {
    setAccessToken(token)
    setUserEmail(decodeJwtSub(token))
    setCompanyRole(decodeCompanyRole(token))
  }, [])

  const handleLogout = useCallback(() => {
    setAccessToken(null)
    setUserEmail(null)
    setCompanyRole("")
    setSelectedRoom(null)
  }, [])

  if (!accessToken) {
    return <AuthGate onLogin={handleLogin} />
  }

  if (!companyRole) {
    return (
      <AuthShell>
        <p className="text-sm text-center text-secondary-foreground">
          This app is for company accounts only.
        </p>
        <Button onClick={handleLogout} className="w-full mt-4">
          Sign out
        </Button>
      </AuthShell>
    )
  }

  if (selectedRoom) {
    return (
      <LiveRoomScreen
        room={selectedRoom}
        token={accessToken}
        onBack={() => setSelectedRoom(null)}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <RoomsScreen
      token={accessToken}
      userEmail={userEmail}
      companyRole={companyRole}
      onSelectRoom={setSelectedRoom}
      onLogout={handleLogout}
    />
  )
}

// There's no public registration for a company account — those are provisioned by an admin on
// the backend (see apps/api's companies.CreateCompany) — so this is login-only.
function AuthGate({ onLogin }: { onLogin: (token: string) => void }) {
  return <LoginScreen onLogin={onLogin} />
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-display">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-signal)] opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-signal)]" />
          </span>
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-secondary-foreground">
            UnGhosted · Interviewer
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        const result = await window.ipcRenderer.login(email, password)
        onLogin(result.accessToken)
      } catch (err) {
        setError(err instanceof Error ? err.message : "That email and password don't match.")
      } finally {
        setLoading(false)
      }
    },
    [email, password, onLogin],
  )

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoFocus
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-sm text-[var(--color-critical)]">{error}</p>}
        <Button type="submit" disabled={loading || !email || !password} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  )
}

function Header({
  eyebrow,
  title,
  onBack,
  right,
  onLogout,
}: {
  eyebrow: string
  title: React.ReactNode
  onBack?: () => void
  right?: React.ReactNode
  onLogout: () => void
}) {
  return (
    <header className="flex items-start justify-between mb-6 pb-4 border-b border-border">
      <div>
        {onBack && (
          <button onClick={onBack} className="text-xs font-mono text-secondary-foreground mb-1 hover:text-foreground">
            ← Sessions
          </button>
        )}
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-secondary-foreground mb-1">{eyebrow}</p>
        <h1 className="text-xl font-semibold font-display">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {right}
        <Button variant="outline" size="sm" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </header>
  )
}

function RoomsScreen({
  token,
  userEmail,
  companyRole,
  onSelectRoom,
  onLogout,
}: {
  token: string
  userEmail: string | null
  companyRole: string
  onSelectRoom: (room: BackendRoom) => void
  onLogout: () => void
}) {
  const [rooms, setRooms] = useState<BackendRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState("")
  const [role, setRole] = useState("")
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRooms(await window.ipcRenderer.listRooms(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load sessions.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setCreating(true)
      setError(null)
      try {
        await window.ipcRenderer.createRoom(token, { candidateName, role, createdBy: userEmail ?? "" })
        setCandidateName("")
        setRole("")
        await loadRooms()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the session.")
      } finally {
        setCreating(false)
      }
    },
    [token, candidateName, role, userEmail, loadRooms],
  )

  const copyRoomId = useCallback((room: BackendRoom) => {
    navigator.clipboard.writeText(room.id)
    setCopiedId(room.id)
    setTimeout(() => setCopiedId((id) => (id === room.id ? null : id)), 1500)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto font-display">
      <Header eyebrow={`${userEmail ?? "Signed in"} · ${companyRole}`} title="Sessions" onLogout={onLogout} />

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <Input
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Candidate name"
          className="flex-1"
        />
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="flex-1" />
        <Button type="submit" disabled={creating || !candidateName.trim() || !role.trim()} className="whitespace-nowrap">
          {creating ? "Creating…" : "New session"}
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--color-critical)] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground font-mono">Loading…</p>
      ) : rooms.length === 0 ? (
        <Card className="border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No sessions yet. Create one above to get a room ID for the candidate.</p>
        </Card>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center justify-between px-3 py-3 text-sm hover:bg-card/60">
              <button className="text-left flex-1 flex items-center gap-3" onClick={() => onSelectRoom(room)}>
                <StatusDot tone={statusTone(room.status)} pulse={room.status === "active"} />
                <span>
                  <span className="font-medium">{room.candidate_name}</span>
                  <span className="text-muted-foreground"> — {room.role}</span>
                </span>
              </button>
              <Button variant="outline" size="sm" onClick={() => copyRoomId(room)} className="shrink-0 font-mono">
                {copiedId === room.id ? "Copied" : `${room.id.slice(0, 8)}…`}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function riskTone(score: number): "signal" | "warning" | "critical" {
  return score >= 60 ? "critical" : score >= 25 ? "warning" : "signal"
}

// Best-effort display mapping from the generic room-stream messages already being received
// (see the RoomChannel subscription below) into the shared AlertEvent shape the moved EventLog
// component expects. Purely a render-time transform of existing state — no new subscriptions,
// no new fetching. The candidate side doesn't actually emit "event" messages onto the wire yet
// (see ROADMAP.md), so this list is expected to stay empty until that's wired up separately.
function toAlertEvents(events: RoomChannelMessage[]): AlertEvent[] {
  return events.map((msg, i) => {
    const payload = "payload" in msg && msg.payload && typeof msg.payload === "object" ? (msg.payload as Record<string, unknown>) : {}
    return {
      id: String(i),
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
      category: typeof payload.category === "string" ? payload.category : "event",
      message: typeof payload.message === "string" ? payload.message : JSON.stringify(payload),
      severity: (["info", "warning", "critical"] as Severity[]).includes(payload.severity as Severity)
        ? (payload.severity as Severity)
        : "info",
    }
  })
}

function LiveRoomScreen({
  room,
  token,
  onBack,
  onLogout,
}: {
  room: BackendRoom
  token: string
  onBack: () => void
  onLogout: () => void
}) {
  const [events, setEvents] = useState<RoomChannelMessage[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [liveRoom, setLiveRoom] = useState<BackendRoom>(room)
  const [respondingToJoin, setRespondingToJoin] = useState(false)
  const [joinActionError, setJoinActionError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    if (liveRoom.join_status === "accepted") return

    const interval = setInterval(async () => {
      try {
        setLiveRoom(await window.ipcRenderer.getRoom(token, room.id))
      } catch {
        // transient poll failure — try again next tick
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [room.id, token, liveRoom.join_status])

  const handleAcceptJoin = useCallback(async () => {
    setRespondingToJoin(true)
    setJoinActionError(null)
    try {
      setLiveRoom(await window.ipcRenderer.acceptJoin(token, room.id))
    } catch (err) {
      setJoinActionError(err instanceof Error ? err.message : "Could not accept the join request")
    } finally {
      setRespondingToJoin(false)
    }
  }, [token, room.id])

  const handleRejectJoin = useCallback(async () => {
    setRespondingToJoin(true)
    setJoinActionError(null)
    try {
      setLiveRoom(await window.ipcRenderer.rejectJoin(token, room.id))
    } catch (err) {
      setJoinActionError(err instanceof Error ? err.message : "Could not reject the join request")
    } finally {
      setRespondingToJoin(false)
    }
  }, [token, room.id])

  const handleEndRoom = useCallback(async () => {
    setEnding(true)
    try {
      setLiveRoom(await window.ipcRenderer.endRoom(token, room.id))
    } finally {
      setEnding(false)
    }
  }, [token, room.id])

  useEffect(() => {
    const channel = new RoomChannel(API_BASE_URL, room.id, token)
    const unsubscribe = channel.onMessage((msg) => {
      if ("type" in msg && msg.type === "event") {
        setEvents((prev) => [...prev.slice(-49), msg])
      }
      if ("type" in msg && msg.type === "risk_score") {
        setRiskScore((msg.payload as { score: number }).score)
      }
    })
    return () => {
      unsubscribe()
      channel.close()
    }
  }, [room.id, token])

  const alertEvents = useMemo(() => toAlertEvents(events), [events])

  const tone = riskTone(riskScore)
  const toneColor =
    tone === "signal" ? "text-[var(--color-signal)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-critical)]"

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto font-display">
      <Header
        eyebrow="Live session"
        title={`${room.candidate_name} — ${room.role}`}
        onBack={onBack}
        onLogout={onLogout}
        right={
          <div className="flex items-center gap-2">
            <StatusDot tone={tone} pulse={tone !== "signal"} />
            <span className={`font-mono text-sm ${toneColor}`}>{riskScore}</span>
          </div>
        }
      />

      {liveRoom.join_status === "requested" && (
        <Card className="border-[var(--color-warning)] p-3 mb-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{liveRoom.requested_by ?? "A candidate"}</span> is asking to join.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRejectJoin} disabled={respondingToJoin}>
                Reject
              </Button>
              <Button size="sm" onClick={handleAcceptJoin} disabled={respondingToJoin}>
                Accept
              </Button>
            </div>
          </div>
          {joinActionError && <p className="text-xs text-[var(--color-critical)]">{joinActionError}</p>}
        </Card>
      )}

      {liveRoom.join_status === "accepted" && liveRoom.status !== "ended" && (
        <div className="flex justify-end mb-4">
          <Button variant="destructive" size="sm" onClick={handleEndRoom} disabled={ending}>
            {ending ? "Ending…" : "End Interview"}
          </Button>
        </div>
      )}

      {/* Framed like a camera viewfinder — this is literally the point of the screen. */}
      <div className="relative border border-border p-3 mb-4">
        <span className="absolute -top-px -left-px h-3 w-3 border-t border-l border-[var(--color-signal)]" />
        <span className="absolute -top-px -right-px h-3 w-3 border-t border-r border-[var(--color-signal)]" />
        <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-[var(--color-signal)]" />
        <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[var(--color-signal)]" />
        <VideoRoom apiBaseUrl={API_BASE_URL} roomId={room.id} token={token} />
      </div>

      {/* Risk + monitoring dashboard — this is the interviewer's view now, not the candidate's
          (see candidate-app/src/App.tsx). Driven by the same events/riskScore state as before;
          only the rendering changed. */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start mb-4">
        <Card className="p-5 flex flex-col items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest self-start">Risk Score</span>
          <RiskGauge score={riskScore} />
        </Card>
        <Card className="p-4 h-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary-foreground">Event log</h2>
            <Badge variant="secondary">{alertEvents.length} events</Badge>
          </div>
          <EventLog events={alertEvents} />
        </Card>
      </div>
    </div>
  )
}
