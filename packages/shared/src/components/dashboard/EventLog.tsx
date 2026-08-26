// Moved from candidate-app/src/App.tsx — see RiskGauge.tsx's header comment. `AlertEvent.timestamp`
// is the shared wire-format ISO string (packages/shared/src/monitoring.ts), not the local `Date`
// candidate-app used internally, since this now renders whatever actually arrives over the room
// stream on the interviewer side.

import { useEffect, useRef } from "react"
import type { AlertEvent } from "../../monitoring"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function EventLog({ events }: { events: AlertEvent[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [events.length])

  const sev = {
    info: { tag: "bg-secondary text-secondary-foreground", dot: "bg-muted-foreground" },
    warning: { tag: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
    critical: { tag: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  }

  return (
    <div ref={ref} className="h-56 overflow-y-auto space-y-1 pr-1">
      {events.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
          No events detected
        </div>
      )}
      {events.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 py-2 px-3 border border-border/60 hover:border-border transition-colors"
        >
          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sev[e.severity].dot}`} />
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0 w-20">{formatTime(e.timestamp)}</span>
          <span className={`text-xs font-mono px-1.5 py-0.5 flex-shrink-0 ${sev[e.severity].tag}`}>{e.category}</span>
          <span className="text-xs text-foreground flex-1">{e.message}</span>
        </div>
      ))}
    </div>
  )
}
