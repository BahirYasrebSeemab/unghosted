// Monitoring-signal vocabulary shared between the candidate app (produces these)
// and the interviewer app (consumes them over the room stream — see
// docs/API_CONTRACT.md's "event"/"monitor_status"/"risk_score" WS messages).
//
// This currently only carries the *types*; the actual detection logic (tab
// visibility, clipboard, keystroke cadence, gaze, etc.) still lives inline in
// packages/candidate-app/src/App.tsx's useEffect hooks and hasn't been moved
// here yet — that's a follow-up once the candidate app's UI is pared down to
// kiosk-only (see ROADMAP.md).

export type Severity = "info" | "warning" | "critical"

export type MonitorKey =
  | "tabFocus"
  | "audio"
  | "gaze"
  | "mouse"
  | "clipboard"
  | "keyboard"
  | "process"

export interface AlertEvent {
  id: string
  timestamp: string // ISO 8601 — was `Date` locally in App.tsx; stays a string once it crosses the wire
  category: string
  message: string
  severity: Severity
}

export interface MonitorState {
  status: "active" | "warning" | "critical" | "offline"
  value: string
  count: number
}

export type Monitors = Record<MonitorKey, MonitorState>

export type WindowFlagType = "EXCLUDE_FROM_CAPTURE" | "MONITOR_ONLY" | "BLACKLISTED_NAME"

export interface FlaggedWindow {
  title: string
  pid: number
  type: WindowFlagType
  matchedTerm?: string
}
