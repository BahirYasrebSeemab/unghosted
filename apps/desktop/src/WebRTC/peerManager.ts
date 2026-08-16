import "./signalingClient.ts"

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

  constructor(signaling, localStream) {
    this.signaling = signaling;
    this.localStream = localStream;
    this.peers = new Map();
    signaling.onOffer = (msg) => this.handleOffer(msg);
    signaling.onAnswer = (msg) => this.handleAnswer(msg);
    signaling.onCandidate = (msg) => this.handleCandidate(msg);
    signaling.onCandidate = (peerIds) => this.handlePeerList(peerIds);
    signaling.onCandidate = (peerId) => this.handlePeerLeft(peerId);
  }

  handlePeerList(peerIds: string[]): void {
    peerIds.forEach((peerId) => this.callPeer(peerId))
  }

  handlePeerLeft(peerId: string): void {
    const client = this.peers.get(peerId);
    if (client) {
      client.close()
      this.peers.delete(peerId);
    }
    this.onPeerLeft?.(peerId);
  }

  createPeerConnection(peerId) {
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
          to: peerId,
          payload: event.candidate,
        });
      }
    };
    this.peers.set(peerId, client);
    return client; // fixed: was `pc`
  }

  async callPeer(peerId) {
    const client = this.createPeerConnection(peerId);
    const offer = await client.createOffer();
    await client.setLocalDescription(offer);
    this.signaling.send({ type: 'offer', from:'', to: peerId, payload: offer });
  }

  async handleOffer(msg) { // fixed: was `handlerOffer`
    const client = this.createPeerConnection(msg.from); // fixed: create it, don't assume it exists
    await client.setRemoteDescription(msg.payload);
    const answer = await client.createAnswer(); // fixed: was `creatAnswer`
    await client.setLocalDescription(answer);
    this.signaling.send({ type: 'answer', from:'', to: msg.from, payload: answer });
  }

  async handleAnswer(msg) {
    const client = this.peers.get(msg.from);
    await client?.setRemoteDescription(msg.payload);
  }

  async handleCandidate(msg) {
    const client = this.peers.get(msg.from);
    if (client) await client.addIceCandidate(msg.payload);
  }
}
