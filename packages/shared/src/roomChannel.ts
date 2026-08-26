// Generalizes packages/candidate-app/src/WebRTC/signalingClient.ts's WS setup into something
// both apps can share. Runs in the renderer (not Electron main, unlike apiClient.ts) — WebRTC
// (RTCPeerConnection, getUserMedia) only exists in the browser context, and unlike fetch/axios,
// a WebSocket handshake isn't subject to CORS, so connecting directly from the renderer is safe
// even though apps/api has no CORS headers configured yet.
//
// One connection carries two message families: WebRTC signaling (matches
// apps/api/internal/signaling/message.go's enum exactly) and the monitoring event stream drafted
// in room-stream.ts. apps/api's hub relays any {type, from, to, payload} message verbatim, so
// both families ride the same relay with no backend changes needed.
//
// The WS URL is derived from the same origin as the REST API (VITE_API_BASE_URL, http(s)) rather
// than a separate VITE_WS_BASE_URL — ported from the feature-share-screen branch's approach. A
// standalone WS env var can silently drift from the real API host (that's exactly what had broken
// candidate<->interviewer streaming: candidate-app had no WS var at all and fell back to
// localhost, interviewer-app's had a stray extra path segment baked in) — deriving it removes that
// whole class of misconfiguration since there's only one URL to get right per app.

import type { RoomStreamMessage } from "./room-stream"

export type SignalType = "offer" | "answer" | "ice-candidate" | "join" | "leave" | "peer-list" | "peer-left"

export interface SignalMessage {
  type: SignalType
  from: string
  to?: string
  payload?: any
}

export type RoomChannelMessage = SignalMessage | RoomStreamMessage

export class RoomChannel {
  private ws: WebSocket
  private listeners = new Set<(msg: RoomChannelMessage) => void>()
  private messageBuffer: RoomChannelMessage[] = []

  constructor(apiBaseUrl: string, roomId: string, token: string) {
    // http(s):// -> ws(s)://, same host/port as the REST API — see the header comment above.
    const wsBaseUrl = apiBaseUrl.replace(/^http/, "ws")
    const url = `${wsBaseUrl}/v1/room/${roomId}/ws?token=${encodeURIComponent(token)}`
    this.ws = new WebSocket(url)
    this.ws.onmessage = (event) => {
      console.log("RAW WS MESSAGE", event.data);
      const msg = JSON.parse(event.data) as RoomChannelMessage

      if (this.listeners.size === 0) {
        this.messageBuffer.push(msg)
      } else {
        this.listeners.forEach((listener) => listener(msg))
      }
    }
  }

  onMessage(listener: (msg: RoomChannelMessage) => void): () => void {
    this.listeners.add(listener)

    if (this.messageBuffer.length > 0) {
      const buffered = this.messageBuffer
      this.messageBuffer = []
      buffered.forEach((msg) => listener(msg))
    }

    return () => this.listeners.delete(listener)
  }

  send(msg: RoomChannelMessage): void {
    this.ws.send(JSON.stringify(msg))
  }

  close(): void {
    this.ws.close()
  }

  waitUntilOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true })
      this.ws.addEventListener("error", (e) => reject(e), { once: true })
    })
  }
}
