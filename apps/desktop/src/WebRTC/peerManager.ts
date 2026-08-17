import SignalingClient  from "./signalingClient"; // adjust based on actual export style

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-list' | 'peer-left';
  from: string;
  to?: string;
  payload?: any;
}

export default class PeerManager {
  signaling: SignalingClient;
  localStream: MediaStream;
  peers: Map<string, RTCPeerConnection>;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerLeft?: (peerId: string) => void;
  pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(signaling: SignalingClient, localStream: MediaStream) {
    this.signaling = signaling;
    this.localStream = localStream;
    this.peers = new Map();

    signaling.onOffer = (msg: SignalMessage) => this.handleOffer(msg);
    signaling.onAnswer = (msg: SignalMessage) => this.handleAnswer(msg);
    signaling.onCandidate = (msg: SignalMessage) => this.handleCandidate(msg);
    signaling.onPeerList = (peerIds: string[]) => this.handlePeerList(peerIds);
    signaling.onPeerLeft = (peerId: string) => this.handlePeerLeft(peerId);
  }

  handlePeerList(peerIds: string[]): void {
    peerIds.forEach((peerId) => this.callPeer(peerId));
  }

  handlePeerLeft(peerId: string): void {
    const client = this.peers.get(peerId);
    if (client) {
      client.close();
      this.peers.delete(peerId);
    }
    this.onPeerLeft?.(peerId);
  }

  createPeerConnection(peerId: string): RTCPeerConnection {
    const client = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    this.localStream.getTracks().forEach((track) => {
      client.addTrack(track, this.localStream);
    });
    client.ontrack = (event) => {
      this.onRemoteStream?.(peerId, event.streams[0]);
    };
    client.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: 'ice-candidate',
          from: '',
          to: peerId,
          payload: event.candidate,
        });
      }
    };
    this.peers.set(peerId, client);
    return client;
  }

  async handleCandidate(msg: SignalMessage): Promise<void> {
    const client = this.peers.get(msg.from);
    if (!client) return;

    if (!client.remoteDescription) {
      const queue = this.pendingCandidates.get(msg.from) ?? [];
      queue.push(msg.payload);
      this.pendingCandidates.set(msg.from, queue);
      return;
    }

    await client.addIceCandidate(msg.payload);
  }

  async flushPendingCandidates(peerId: string): Promise <void> {
    const client = this.peers.get(peerId);
    const queue = this.pendingCandidates.get(peerId);
    if (!client || !queue) return;

    for (const candidate of queue) {
      await client.addIceCandidate(candidate);
    }

    this.pendingCandidates.delete(peerId);
  }


  async callPeer(peerId: string): Promise<void> {
    const client = this.createPeerConnection(peerId);
    const offer = await client.createOffer();
    await client.setLocalDescription(offer);
    this.signaling.send({ type: 'offer', from: '', to: peerId, payload: offer });
  }

  async handleOffer(msg: SignalMessage): Promise<void> {
    const client = this.createPeerConnection(msg.from);
    await client.setRemoteDescription(msg.payload);
    await this.flushPendingCandidates(msg.from)
    const answer = await client.createAnswer();
    await client.setLocalDescription(answer);
    this.signaling.send({ type: 'answer', from: '', to: msg.from, payload: answer });
  }

  async handleAnswer(msg: SignalMessage): Promise<void> {
    const client = this.peers.get(msg.from);
    if (!client) return

      if (client.signalingState !== 'have-local-offer') {
        console.warn(`Ignoring answer from ${msg.from}, unexpected state: ${client.signalingState}`)
        return
      }

    await client.setRemoteDescription(msg.payload);
    await this.flushPendingCandidates(msg.from)
  }
}
