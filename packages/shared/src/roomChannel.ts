// Go backend WebSocket — carries the monitoring event stream only.
// WebRTC signaling (offer/answer/ice-candidate/peer-list/peer-left) is now
// handled entirely by @metered-ca/realtime on the client side; none of those
// message types flow through here any more.  The url derives from the same
// origin as the REST API (http(s) -> ws(s)) to avoid the class of
// misconfiguration that broke candidate<->interviewer streaming when a
// separate VITE_WS_BASE_URL drifted from the real API host.

import type { RoomStreamMessage } from "./room-stream"

export type RoomChannelMessage = RoomStreamMessage

export class RoomChannel {
  private ws: WebSocket
  private listeners = new Set<(msg: RoomChannelMessage) => void>()
  private messageBuffer: RoomChannelMessage[] = []

  constructor(apiBaseUrl: string, roomId: string, token: string) {
    const wsBaseUrl = apiBaseUrl.replace(/^http/, "ws")
    const url = `${wsBaseUrl}/v1/rooms/${roomId}/stream?token=${encodeURIComponent(token)}`
    this.ws = new WebSocket(url)
    this.ws.onmessage = (event) => {
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
