// Wire-format types for the WS room stream described in docs/API_CONTRACT.md.
// Draft/unconfirmed with the backend team — update this alongside that doc.

import type { AlertEvent, MonitorKey, MonitorState } from "./monitoring"

export type RoomStreamMessage =
  | { type: "event"; payload: Pick<AlertEvent, "category" | "message" | "severity">; ts: string }
  | { type: "monitor_status"; payload: { key: MonitorKey } & MonitorState; ts: string }
  | { type: "risk_score"; payload: { score: number }; ts: string }
  | { type: "room_control"; payload: { action: "end_session" }; ts: string }
  | {
      type: "chat_message"
      payload: { id: string; senderRole: "interviewer" | "candidate"; text?: string; fileId?: string }
      ts: string
    }

export type RoomStatus = "scheduled" | "active" | "ended"

export interface Room {
  id: string
  orgId: string
  createdBy: string
  candidateName: string
  role: string
  status: RoomStatus
  joinCode: string
  createdAt: string
  startedAt?: string
  endedAt?: string
}
