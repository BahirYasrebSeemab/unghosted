// Moved here from candidate-app's WebRTC/ folder — pure WebRTC logic with nothing
// candidate-app-specific, so both apps can reuse it (an interviewer joining a room is just
// another peer, per apps/api/internal/signaling/hub.go's generic per-room relay).
//
// Connection-handling ported from the feature-share-screen branch's apps/desktop/src/WebRTC/
// peerManager.ts (offer-reuse on handleOffer, ICE candidate queuing before a connection exists,
// onnegotiationneeded, and live screen-share track add/remove) — see roomChannel.ts's header for
// why the two branches' WS wire format didn't need to change to pick this up. That branch's own
// remote-screen-share handling was left half-built (an unused, commented-out onRemoteTrack callback
// that never actually got wired to ontrack) — onRemoteScreenShare below finishes that: it
// distinguishes a peer's camera stream from a later-added screen-share stream by stream id, since
// they arrive as two separate MediaStreams over the same connection.

import type { RoomChannel } from "./roomChannel"
import type { SignalMessage } from "./roomChannel"

export interface RemoteStream {
  peerId: string
  stream: MediaStream
}

const defaultIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

export default class PeerManager {
  private channel: RoomChannel
  localStream: MediaStream
  peers: Map<string, RTCPeerConnection>
  private iceServers: RTCIceServer[]
  private cameraStreamIds: Map<string, string> = new Map()
  private screenStream?: MediaStream
  onRemoteStream?: (peerId: string, stream: MediaStream) => void
  onRemoteScreenShare?: (peerId: string, stream: MediaStream | null) => void
  onPeerLeft?: (peerId: string) => void
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map()
  private unsubscribe: () => void

  constructor(channel: RoomChannel, localStream: MediaStream, iceServers: RTCIceServer[] = defaultIceServers) {
    this.channel = channel
    this.localStream = localStream
    this.iceServers = iceServers
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
    this.cameraStreamIds.delete(peerId)
    this.onPeerLeft?.(peerId)
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const client = new RTCPeerConnection({
      iceServers: this.iceServers,
    })
    this.localStream.getTracks().forEach((track) => {
      client.addTrack(track, this.localStream)
    })
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        client.addTrack(track, this.screenStream!)
      })
    }
    client.ontrack = (event) => {
      const stream = event.streams[0]
      const knownCameraId = this.cameraStreamIds.get(peerId)
      if (knownCameraId === undefined) {
        // First stream we ever see from this peer is their camera+mic — everything after is
        // a later-negotiated addition (screen share).
        this.cameraStreamIds.set(peerId, stream.id)
        this.onRemoteStream?.(peerId, stream)
      } else if (stream.id !== knownCameraId) {
        this.onRemoteScreenShare?.(peerId, stream)
        // The far side signals "stopped sharing" by removing the track, which ends it here.
        event.track.onended = () => this.onRemoteScreenShare?.(peerId, null)
      }
    }
    client.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({ type: "ice-candidate", from: "", to: peerId, payload: event.candidate })
      }
    }
    // Fires when a track is added/removed on an already-connected peer (screen-share
    // start/stop) — without this, only the initial call negotiates; later track changes
    // would silently never reach the other side.
    client.onnegotiationneeded = async () => {
      try {
        const offer = await client.createOffer()
        await client.setLocalDescription(offer)
        this.channel.send({ type: "offer", from: "", to: peerId, payload: offer })
      } catch (err) {
        console.error(`[${peerId}] renegotiation failed:`, err)
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

    // No peer connection yet (candidate arrived before the offer/answer that creates one) —
    // queue it instead of dropping it; flushPendingCandidates replays it once the connection
    // exists and has a remote description.
    if (!client || !client.remoteDescription) {
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
    // Reuse the existing connection for this peer if one's already up — renegotiation offers
    // (screen-share start/stop) arrive as new "offer" messages on the same peer, and blowing
    // away the live connection here would drop the call instead of just updating its tracks.
    const client = this.peers.get(msg.from) ?? this.createPeerConnection(msg.from)
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

  async startScreenShare(): Promise<void> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const screenTrack = this.screenStream.getVideoTracks()[0]

    this.peers.forEach((client) => {
      client.addTrack(screenTrack, this.screenStream!) // triggers onnegotiationneeded
    })

    screenTrack.onended = () => this.stopScreenShare()
  }

  stopScreenShare(): void {
    if (!this.screenStream) return
    const screenTrack = this.screenStream.getVideoTracks()[0]

    this.peers.forEach((client) => {
      const sender = client.getSenders().find((s) => s.track === screenTrack)
      if (sender) client.removeTrack(sender) // triggers onnegotiationneeded
    })

    screenTrack.stop()
    this.screenStream = undefined
  }

  close(): void {
    this.unsubscribe()
    this.stopScreenShare()
    this.peers.forEach((client) => client.close())
    this.peers.clear()
    this.cameraStreamIds.clear()
  }
}
