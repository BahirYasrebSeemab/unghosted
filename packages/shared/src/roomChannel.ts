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

  constructor(wsBaseUrl: string, roomId: string, token: string) {
    const url = `${wsBaseUrl}/${roomId}/ws?token=${encodeURIComponent(token)}`
    this.ws = new WebSocket(url)
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as RoomChannelMessage
      this.listeners.forEach((listener) => listener(msg))
    }
  }

  onMessage(listener: (msg: RoomChannelMessage) => void): () => void {
    this.listeners.add(listener)
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
