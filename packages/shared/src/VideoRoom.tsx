// Shared between both apps — an interviewer joining a room is just another peer, per
// apps/api/internal/signaling/hub.go's generic per-room relay, so this component doesn't need to
// know or care whether it's rendered in candidate-app or interviewer-app.

import { useEffect, useRef, useState } from "react"
import { RoomChannel } from "./roomChannel"
import PeerManager from "./peerManager"

interface RemoteStream {
  peerId: string
  stream: MediaStream
}

export default function VideoRoom({ wsBaseUrl, roomId, token }: { wsBaseUrl: string; roomId: string; token: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
  const peerManagerRef = useRef<PeerManager | null>(null)
  const setupDone = useRef(false)

  useEffect(() => {
    if (setupDone.current) return
    setupDone.current = true

    let localStream: MediaStream

    async function setup() {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
      }
      const channel = new RoomChannel(wsBaseUrl, roomId, token)
      const peerManager = new PeerManager(channel, localStream)
      peerManagerRef.current = peerManager
      peerManager.onRemoteStream = (peerId, stream) => {
        setRemoteStreams((prev) => {
          const exists = prev.find((r) => r.peerId === peerId)
          if (exists) return prev
          return [...prev, { peerId, stream }]
        })
      }
      peerManager.onPeerLeft = (peerId) => {
        setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId))
      }
    }
    setup()
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
      peerManagerRef.current?.close()
    }
  }, [wsBaseUrl, roomId, token])

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300 }} />
      {remoteStreams.map(({ peerId, stream }) => (
        <RemoteVideo key={peerId} stream={stream} />
      ))}
    </div>
  )
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  return <video ref={videoRef} autoPlay playsInline style={{ width: 300 }} />
}
