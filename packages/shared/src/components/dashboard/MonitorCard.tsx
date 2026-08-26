// Moved from candidate-app/src/App.tsx — see RiskGauge.tsx's header comment. Same status ->
// color mapping, restyled to the shared theme tokens (signal/warning/critical) instead of
// hardcoded Tailwind palette colors, and sharp corners to match the rest of the redesign.

import { Card } from "../ui/card"
import type { MonitorState } from "../../monitoring"

export function MonitorCard({
  icon,
  label,
  monitor,
}: {
  icon: string
  label: string
  monitor: MonitorState
}) {
  const colors = {
    active: { dot: "bg-[var(--color-signal)]", text: "text-[var(--color-signal)]", border: "border-[var(--color-signal)]/30" },
    warning: { dot: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]", border: "border-[var(--color-warning)]/40" },
    critical: { dot: "bg-destructive animate-pulse", text: "text-destructive", border: "border-destructive/40" },
    offline: { dot: "bg-muted-foreground", text: "text-muted-foreground", border: "border-border" },
  }
  const c = colors[monitor.status]

  return (
    <Card className={`p-3 flex flex-col gap-2 transition-colors ${c.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      </div>
      <div className={`text-xs font-mono ${c.text} truncate`}>{monitor.value}</div>
      {monitor.count > 0 && (
        <div className="text-xs text-muted-foreground font-mono">
          {monitor.count} event{monitor.count !== 1 ? "s" : ""}
        </div>
      )}
    </Card>
  )
}
