// Moved from candidate-app/src/App.tsx — the candidate is not shown their own risk score, this
// dashboard is interviewer-only now. Same gauge logic (score -> color band), restyled to the
// shared theme tokens instead of hardcoded hex.

export function RiskGauge({ score }: { score: number }) {
  const color =
    score < 25 ? "var(--color-signal)" : score < 60 ? "var(--color-warning)" : "var(--color-critical)"
  const label = score < 25 ? "LOW RISK" : score < 60 ? "ELEVATED" : "HIGH RISK"
  const circumference = 2 * Math.PI * 52
  const arc = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-muted-foreground font-mono">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-mono font-medium tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
