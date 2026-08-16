import { useEffect, useRef, useState } from 'react';
import SignalingClient from "../WebRTC/signalingClient.ts"
import PeerManager from "../WebRTC/peerManager.ts"

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
}

export default function VideoRoom({ roomId, token }: { roomId: string; token: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const peerManagerRef = useRef<PeerManager | null>(null);

  useEffect(() => {
    let localStream: MediaStream;

    async function setup() {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      const signaling = new SignalingClient(roomId, token);
      const peerManager = new PeerManager(signaling, localStream);
      peerManagerRef.current = peerManager;

      peerManager.onRemoteStream = (peerId, stream) => {
        setRemoteStreams((prev) => {
          const exists = prev.find((r) => r.peerId === peerId);
          if (exists) return prev;
          return [...prev, { peerId, stream }];
        });
      };

      peerManager.onPeerLeft = (peerId) => {
        setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId));
      };
    }

    setup();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      peerManagerRef.current?.peers.forEach((client) => client.close());
    };
  }, [roomId, token]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300 }} />
      {remoteStreams.map(({ peerId, stream }) => (
        <RemoteVideo key={peerId} stream={stream} />
      ))}
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline style={{ width: 300 }} />;
}
