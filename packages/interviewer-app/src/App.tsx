import { useCallback, useEffect, useState } from "react"
import type { BackendRoom, RoomChannelMessage } from "@unghosted/shared"
import { RoomChannel, VideoRoom } from "@unghosted/shared"

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000"

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<BackendRoom | null>(null)

  if (!accessToken) {
    return <AuthGate onLogin={setAccessToken} />
  }

  if (selectedRoom) {
    return (
      <LiveRoomScreen room={selectedRoom} token={accessToken} onBack={() => setSelectedRoom(null)} />
    )
  }

  return <RoomsScreen token={accessToken} onSelectRoom={setSelectedRoom} />
}

// There's no browser chrome / URL bar in this Electron window to navigate between auth screens,
// so login/register live behind one in-app switch instead of separate routes.
function AuthGate({ onLogin }: { onLogin: (token: string) => void }) {
  const [screen, setScreen] = useState<"login" | "register">("login")
  const [prefillEmail, setPrefillEmail] = useState("")

  if (screen === "register") {
    return (
      <RegisterScreen
        onDone={(email) => {
          setPrefillEmail(email)
          setScreen("login")
        }}
        onBackToLogin={() => setScreen("login")}
      />
    )
  }

  return (
    <LoginScreen onLogin={onLogin} onGoToRegister={() => setScreen("register")} initialEmail={prefillEmail} />
  )
}

function LoginScreen({
  onLogin,
  onGoToRegister,
  initialEmail,
}: {
  onLogin: (token: string) => void
  onGoToRegister: () => void
  initialEmail: string
}) {
  const [email, setEmail] = useState(initialEmail)
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
        setError(err instanceof Error ? err.message : "Login failed")
      } finally {
        setLoading(false)
      }
    },
    [email, password, onLogin],
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold">UnGhosted Interviewer</h1>
          <p className="text-sm text-secondary-foreground">Sign in to manage interview rooms.</p>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-accent text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-primary text-primary-foreground font-medium rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-center text-secondary-foreground">
          No account yet?{" "}
          <button type="button" onClick={onGoToRegister} className="text-primary underline">
            Create one
          </button>
        </p>
      </form>
    </div>
  )
}

// Registration is two steps against the real backend: sendCode (creates a pending temp user,
// emails a verification code) then register (confirms the code, creates the real user).
function RegisterScreen({
  onDone,
  onBackToLogin,
}: {
  onDone: (email: string) => void
  onBackToLogin: () => void
}) {
  const [step, setStep] = useState<"details" | "code">("details")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSendCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        await window.ipcRenderer.sendCode(name, email, password)
        setStep("code")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send verification code")
      } finally {
        setLoading(false)
      }
    },
    [name, email, password],
  )

  const handleConfirm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        await window.ipcRenderer.register(email, Number(code))
        onDone(email)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not confirm that code")
      } finally {
        setLoading(false)
      }
    },
    [email, code, onDone],
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      {step === "details" ? (
        <form onSubmit={handleSendCode} className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold">Create an account</h1>
            <p className="text-sm text-secondary-foreground">We'll email you a verification code.</p>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
            autoFocus
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-accent text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name || !email || !password}
            className="w-full bg-primary text-primary-foreground font-medium rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send code"}
          </button>
          <p className="text-sm text-center text-secondary-foreground">
            <button type="button" onClick={onBackToLogin} className="text-primary underline">
              Back to sign in
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold">Check your email</h1>
            <p className="text-sm text-secondary-foreground">Enter the verification code sent to {email}.</p>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            className="w-full bg-card border border-border rounded px-3 py-2 text-sm font-mono tracking-widest text-center"
            autoFocus
          />
          {error && <p className="text-sm text-accent text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-primary text-primary-foreground font-medium rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Confirming…" : "Confirm"}
          </button>
        </form>
      )}
    </div>
  )
}

function RoomsScreen({ token, onSelectRoom }: { token: string; onSelectRoom: (room: BackendRoom) => void }) {
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
      setError(err instanceof Error ? err.message : "Could not load rooms")
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
        await window.ipcRenderer.createRoom(token, { candidateName, role, createdBy: "" })
        setCandidateName("")
        setRole("")
        await loadRooms()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create room")
      } finally {
        setCreating(false)
      }
    },
    [token, candidateName, role, loadRooms],
  )

  const copyJoinCode = useCallback((room: BackendRoom) => {
    navigator.clipboard.writeText(room.join_code)
    setCopiedId(room.id)
    setTimeout(() => setCopiedId((id) => (id === room.id ? null : id)), 1500)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-lg font-semibold">Interview Rooms</h1>
      </header>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Candidate name"
          className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={creating || !candidateName.trim() || !role.trim()}
          className="bg-primary text-primary-foreground font-medium rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create room"}
        </button>
      </form>

      {error && <p className="text-sm text-accent">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rooms yet — create one above.</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between bg-card border border-border rounded px-3 py-2 text-sm"
            >
              <button className="text-left flex-1" onClick={() => onSelectRoom(room)}>
                <span className="font-medium">{room.candidate_name}</span>
                <span className="text-muted-foreground"> — {room.role}</span>
                <span className="ml-2 text-xs uppercase text-secondary-foreground">{room.status}</span>
              </button>
              <button
                onClick={() => copyJoinCode(room)}
                className="font-mono text-xs text-secondary-foreground border border-border rounded px-2 py-1"
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

function LiveRoomScreen({ room, token, onBack }: { room: BackendRoom; token: string; onBack: () => void }) {
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

  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-secondary-foreground mb-1">
            ← Rooms
          </button>
          <h1 className="text-lg font-semibold">
            {room.candidate_name} — {room.role}
          </h1>
        </div>
        <div className="text-sm font-mono text-secondary-foreground">Risk: {riskScore}</div>
      </header>

      <VideoRoom wsBaseUrl={WS_BASE_URL} roomId={room.id} token={token} />

      <div className="bg-card border border-border rounded p-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Event log</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {events.map((msg, i) => (
              <li key={i}>{JSON.stringify("payload" in msg ? msg.payload : msg)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
