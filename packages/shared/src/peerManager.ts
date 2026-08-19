// Moved here from candidate-app's WebRTC/ folder — pure WebRTC logic with nothing
// candidate-app-specific, so both apps can reuse it (an interviewer joining a room is just
// another peer, per apps/api/internal/signaling/hub.go's generic per-room relay).

import type { RoomChannel } from "./roomChannel"
import type { SignalMessage } from "./roomChannel"

export default class PeerManager {
  private channel: RoomChannel
  localStream: MediaStream
  peers: Map<string, RTCPeerConnection>
  onRemoteStream?: (peerId: string, stream: MediaStream) => void
  onPeerLeft?: (peerId: string) => void
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map()
  private unsubscribe: () => void

  constructor(channel: RoomChannel, localStream: MediaStream) {
    this.channel = channel
    this.localStream = localStream
    this.peers = new Map()
    this.unsubscribe = channel.onMessage((msg) => this.handleMessage(msg))
  }

  private handleMessage(msg: unknown): void {
    if (typeof msg !== "object" || msg === null || !("type" in msg)) return
    const signal = msg as SignalMessage
    switch (signal.type) {
      case "offer":
        this.handleOffer(signal)
        break
      case "answer":
        this.handleAnswer(signal)
        break
      case "ice-candidate":
        this.handleCandidate(signal)
        break
      case "peer-list": {
        const peers = (signal.payload as { peers: string[] }).peers
        peers.forEach((peerId) => this.callPeer(peerId))
        break
      }
      case "peer-left":
        this.handlePeerLeft(signal.from)
        break
    }
  }

  private handlePeerLeft(peerId: string): void {
    const client = this.peers.get(peerId)
    if (client) {
      client.close()
      this.peers.delete(peerId)
    }
    this.onPeerLeft?.(peerId)
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const client = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })
    this.localStream.getTracks().forEach((track) => {
      client.addTrack(track, this.localStream)
    })
    client.ontrack = (event) => {
      this.onRemoteStream?.(peerId, event.streams[0])
    }
    client.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({ type: "ice-candidate", from: "", to: peerId, payload: event.candidate })
      }
    }
    client.onconnectionstatechange = () => {
      console.log(`[${peerId}] connection state:`, client.connectionState)
    }
    this.peers.set(peerId, client)
    return client
  }

  private async handleCandidate(msg: SignalMessage): Promise<void> {
    const client = this.peers.get(msg.from)
    if (!client) return

    if (!client.remoteDescription) {
      const queue = this.pendingCandidates.get(msg.from) ?? []
      queue.push(msg.payload)
      this.pendingCandidates.set(msg.from, queue)
      return
    }

    await client.addIceCandidate(msg.payload)
  }

  private async flushPendingCandidates(peerId: string): Promise<void> {
    const client = this.peers.get(peerId)
    const queue = this.pendingCandidates.get(peerId)
    if (!client || !queue) return

    for (const candidate of queue) {
      await client.addIceCandidate(candidate)
    }

    this.pendingCandidates.delete(peerId)
  }

  private async callPeer(peerId: string): Promise<void> {
    const client = this.createPeerConnection(peerId)
    const offer = await client.createOffer()
    await client.setLocalDescription(offer)
    this.channel.send({ type: "offer", from: "", to: peerId, payload: offer })
  }

  private async handleOffer(msg: SignalMessage): Promise<void> {
    const client = this.createPeerConnection(msg.from)
    await client.setRemoteDescription(msg.payload)
    await this.flushPendingCandidates(msg.from)
    const answer = await client.createAnswer()
    await client.setLocalDescription(answer)
    this.channel.send({ type: "answer", from: "", to: msg.from, payload: answer })
  }

  private async handleAnswer(msg: SignalMessage): Promise<void> {
    const client = this.peers.get(msg.from)
    if (!client) return

    if (client.signalingState !== "have-local-offer") {
      console.warn(`Ignoring answer from ${msg.from}, unexpected state: ${client.signalingState}`)
      return
    }

    await client.setRemoteDescription(msg.payload)
    await this.flushPendingCandidates(msg.from)
  }

  close(): void {
    this.unsubscribe()
    this.peers.forEach((client) => client.close())
    this.peers.clear()
  }
}
