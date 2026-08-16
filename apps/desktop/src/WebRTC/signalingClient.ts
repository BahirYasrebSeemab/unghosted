interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-list' | 'peer-left';
  from: string;
  to?:  string;
  payload?: any;
}

interface PeerListPayload {
  peers: string[];
}

export default class SignalingClient {
  ws:           WebSocket;
  token:        string;
  onOffer?:     (msg: SignalMessage) => void;
  onCandidate?:     (msg: SignalMessage) => void;
  onAnswer?:     (msg: SignalMessage) => void;
  onPeerList?:     (peers: string[]) => void;
  onPeerLeft?:     (peerId: string) => void;

  
  constructor(roomId: string, token: string) {
    this.ws = new WebSocket(`ws://localhost:3000/v1/room/${roomId}/ws?token=${token}`);
    // this.ws.onopen = () => this.send({ type: 'join', from: '' });
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    // this.onOffer = null;
    // this.onAnswer = null;
    // this.onCandidate = null;
    this.token = token;
  }

  send(msg: SignalMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  handleMessage(msg: SignalMessage): void {
    switch (msg.type) {
      case 'offer': this.onOffer?.(msg); break;
      case 'answer': this.onAnswer?.(msg); break;
      case 'ice-candidate': this.onCandidate?.(msg); break;
      case 'peer-list': {
        const payload: PeerListPayload = msg.payload;
        this.onPeerList?.(payload.peers);
        break;
      }
      case 'peer-left': this.onPeerLeft?.(msg.from); break;
    }
  }
}
