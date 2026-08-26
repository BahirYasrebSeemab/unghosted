import { useCallback, useEffect, useState } from "react"
import type { BackendCompany } from "@unghosted/shared"
import { Button, Input, Card } from "@unghosted/shared"
import * as api from "./apiClient"

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)

  // There's no /v1/admin/logout endpoint on the backend today — "log out" here just drops back
  // to the login screen. The admin_token cookie stays valid server-side until it expires.
  const handleLogout = useCallback(() => {
    setLoggedIn(false)
  }, [])

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />
  }

  return <Dashboard onLogout={handleLogout} />
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
            UnGhosted · Admin
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
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
        await api.adminLogin(email, password)
        onLogin()
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

function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="flex items-start justify-between mb-6 pb-4 border-b border-border">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-secondary-foreground mb-1">Admin</p>
        <h1 className="text-xl font-semibold font-display">Companies</h1>
      </div>
      <Button variant="outline" size="sm" onClick={onLogout}>
        Sign out
      </Button>
    </header>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [companies, setCompanies] = useState<BackendCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerPassword, setOwnerPassword] = useState("")
  const [creating, setCreating] = useState(false)

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCompanies(await api.listCompanies())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load companies.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setCreating(true)
      setError(null)
      try {
        await api.createCompany({ name, ownerName, ownerEmail, ownerPassword })
        setName("")
        setOwnerName("")
        setOwnerEmail("")
        setOwnerPassword("")
        await loadCompanies()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the company.")
      } finally {
        setCreating(false)
      }
    },
    [name, ownerName, ownerEmail, ownerPassword, loadCompanies],
  )

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto font-display">
      <Header onLogout={onLogout} />

      <form onSubmit={handleCreate} className="grid grid-cols-2 gap-2 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          className="col-span-2"
        />
        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" />
        <Input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="Owner email"
        />
        <Input
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          placeholder="Owner password"
          className="col-span-2"
        />
        <Button
          type="submit"
          disabled={creating || !name.trim() || !ownerName.trim() || !ownerEmail.trim() || !ownerPassword.trim()}
          className="col-span-2"
        >
          {creating ? "Creating…" : "New company"}
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--color-critical)] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-secondary-foreground">Loading…</p>
      ) : companies.length === 0 ? (
        <p className="text-sm text-secondary-foreground">No companies yet.</p>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <CompanyRow key={company.Id} company={company} onChanged={loadCompanies} />
          ))}
        </div>
      )}
    </div>
  )
}

function CompanyRow({ company, onChanged }: { company: BackendCompany; onChanged: () => void }) {
  const [amount, setAmount] = useState("100")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adjust = useCallback(
    async (direction: "increase" | "reduce") => {
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0) return
      setBusy(true)
      setError(null)
      try {
        if (direction === "increase") {
          await api.increaseBalance(company.Id, value)
        } else {
          await api.reduceBalance(company.Id, value)
        }
        await onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update balance.")
      } finally {
        setBusy(false)
      }
    },
    [amount, company.Id, onChanged],
  )

  return (
    <Card className="px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{company.Name}</p>
          <p className="text-xs text-secondary-foreground">{company.Owner}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-secondary-foreground">Balance: {company.Balance}</span>
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 h-8 text-xs"
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => adjust("increase")}>
            Add
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => adjust("reduce")}>
            Reduce
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-[var(--color-critical)] mt-1">{error}</p>}
    </Card>
  )
}
