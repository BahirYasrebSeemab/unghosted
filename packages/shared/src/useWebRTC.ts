import { useEffect, useRef, useState } from "react"
import PeerManager, { type RemoteStream } from "./peerManager"
import { useSignaling } from "./useSignaling"
import { useTurnCredentials } from "./useTurnCredentials"

export function useWebRTC(wsBaseUrl: string, roomId: string, token: string, localStream: MediaStream | null) {
  const { channel } = useSignaling(wsBaseUrl, roomId, token)
  const iceServers = useTurnCredentials()
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
  const peerManagerRef = useRef<PeerManager | null>(null)
  const wiredUp = useRef(false)

  useEffect(() => {
    if (!localStream || !channel || !iceServers || wiredUp.current) return
    wiredUp.current = true

    const peerManager = new PeerManager(channel, localStream, iceServers)
    peerManagerRef.current = peerManager

    peerManager.onRemoteStream = (peerId, stream) => {
      setRemoteStreams((prev) => {
        if (prev.find((r) => r.peerId === peerId)) return prev
        return [...prev, { peerId, stream }]
      })
    }
    peerManager.onPeerLeft = (peerId) => {
      setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId))
    }

    return () => {
      peerManager.close()
    }
  }, [localStream, channel, iceServers])

  return { remoteStreams }
}
