import { useCallback, useState } from "react"
import { Button, Input } from "@unghosted/shared"

export function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json).sub ?? null
  } catch {
    return null
  }
}

// There's no browser chrome / URL bar in this Electron window to navigate between auth screens,
// so login/register live behind one in-app switch instead of separate routes.
export function AuthGate({ onLogin }: { onLogin: (token: string) => void }) {
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

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-secondary-foreground">
            UnGhosted · Candidate
          </span>
        </div>
        {children}
      </div>
    </div>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading || !email || !password} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-center text-secondary-foreground pt-2">
          New here?{" "}
          <button type="button" onClick={onGoToRegister} className="text-foreground underline underline-offset-2">
            Create an account
          </button>
        </p>
      </form>
    </AuthShell>
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
        setError(err instanceof Error ? err.message : "Couldn't send a verification code.")
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
        setError(err instanceof Error ? err.message : "That code didn't match.")
      } finally {
        setLoading(false)
      }
    },
    [email, code, onDone],
  )

  return (
    <AuthShell>
      {step === "details" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !name || !email || !password} className="w-full">
            {loading ? "Sending…" : "Send verification code"}
          </Button>
          <p className="text-sm text-center text-secondary-foreground pt-2">
            <button type="button" onClick={onBackToLogin} className="underline underline-offset-2">
              Back to sign in
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3">
          <p className="text-sm text-secondary-foreground text-center">
            Enter the code sent to <span className="text-foreground">{email}</span>.
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            className="font-mono tracking-widest text-center"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !code.trim()} className="w-full">
            {loading ? "Confirming…" : "Confirm"}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
