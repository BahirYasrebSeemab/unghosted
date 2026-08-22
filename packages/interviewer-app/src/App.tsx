import { useCallback, useEffect, useState } from "react"
import type { BackendRoom, RoomChannelMessage } from "@unghosted/shared"
import { RoomChannel, VideoRoom } from "@unghosted/shared"

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000"

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
        <button
          type="button"
          onClick={handleLogout}
          className="w-full mt-4 bg-primary text-primary-foreground font-medium rounded px-3 py-2.5 text-sm"
        >
          Sign out
        </button>
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

// There's no public registration for a company/admin account — those are provisioned by an
// admin on the backend (see apps/api's companies.CreateCompany) — so this is login-only.
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
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {error && <p className="text-sm text-[var(--color-critical)]">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-primary text-primary-foreground font-medium rounded px-3 py-2.5 text-sm disabled:opacity-40 transition-opacity"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
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
        <button
          onClick={onLogout}
          className="text-xs font-mono text-secondary-foreground border border-border rounded px-2.5 py-1.5 hover:text-foreground hover:border-foreground/30"
        >
          Sign out
        </button>
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

  const copyJoinCode = useCallback((room: BackendRoom) => {
    navigator.clipboard.writeText(room.join_code)
    setCopiedId(room.id)
    setTimeout(() => setCopiedId((id) => (id === room.id ? null : id)), 1500)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto font-display">
      <Header eyebrow={`${userEmail ?? "Signed in"} · ${companyRole}`} title="Sessions" onLogout={onLogout} />

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Candidate name"
          className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={creating || !candidateName.trim() || !role.trim()}
          className="bg-primary text-primary-foreground font-medium rounded px-4 py-2 text-sm disabled:opacity-40 whitespace-nowrap"
        >
          {creating ? "Creating…" : "New session"}
        </button>
      </form>

      {error && <p className="text-sm text-[var(--color-critical)] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground font-mono">Loading…</p>
      ) : rooms.length === 0 ? (
        <div className="border border-dashed border-border rounded p-6 text-center">
          <p className="text-sm text-muted-foreground">No sessions yet. Create one above to get a join code for the candidate.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center justify-between px-3 py-3 text-sm hover:bg-card/60">
              <button className="text-left flex-1 flex items-center gap-3" onClick={() => onSelectRoom(room)}>
                <StatusDot tone={statusTone(room.status)} pulse={room.status === "active"} />
                <span>
                  <span className="font-medium">{room.candidate_name}</span>
                  <span className="text-muted-foreground"> — {room.role}</span>
                </span>
              </button>
              <button
                onClick={() => copyJoinCode(room)}
                className="font-mono text-xs text-secondary-foreground border border-border rounded px-2 py-1 hover:text-foreground shrink-0"
              >
                {copiedId === room.id ? "Copied" : room.join_code}
              </button>
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

  useEffect(() => {
    const channel = new RoomChannel(WS_BASE_URL, room.id, token)
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

      {/* Framed like a camera viewfinder — this is literally the point of the screen. */}
      <div className="relative border border-border rounded p-3 mb-4">
        <span className="absolute -top-px -left-px h-3 w-3 border-t border-l border-[var(--color-signal)]" />
        <span className="absolute -top-px -right-px h-3 w-3 border-t border-r border-[var(--color-signal)]" />
        <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-[var(--color-signal)]" />
        <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[var(--color-signal)]" />
        <VideoRoom wsBaseUrl={WS_BASE_URL} roomId={room.id} token={token} />
      </div>

      <div className="bg-card border border-border rounded p-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary-foreground mb-2">Event log</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
            {events.map((msg, i) => (
              <li key={i} className="text-secondary-foreground">
                {JSON.stringify("payload" in msg ? msg.payload : msg)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
