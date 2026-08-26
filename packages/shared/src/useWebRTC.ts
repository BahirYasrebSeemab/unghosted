import { useCallback, useEffect, useRef, useState } from "react"
import PeerManager, { type RemoteStream } from "./peerManager"
import { useSignaling } from "./useSignaling"
import { useTurnCredentials } from "./useTurnCredentials"

export function useWebRTC(apiBaseUrl: string, roomId: string, token: string, localStream: MediaStream | null) {
  const { channel } = useSignaling(apiBaseUrl, roomId, token)
  const iceServers = useTurnCredentials()
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
  const [remoteScreenShares, setRemoteScreenShares] = useState<RemoteStream[]>([])
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const peerManagerRef = useRef<PeerManager | null>(null)
  const wiredUp = useRef(false)

  useEffect(() => {
      console.log('wiring check:', { hasLocalStream: !!localStream, hasChannel: !!channel, hasIceServers: !!iceServers, wiredUp: wiredUp.current })

    if (!localStream || !channel || !iceServers || wiredUp.current) {
      console.log('BLOCKED:', { localStream: !!localStream, channel: !!channel, iceServers: !!iceServers, wiredUp: wiredUp.current })
      return
    }
    wiredUp.current = true

    const peerManager = new PeerManager(channel, localStream, iceServers)
    peerManagerRef.current = peerManager

    peerManager.onRemoteStream = (peerId, stream) => {
      setRemoteStreams((prev) => {
        if (prev.find((r) => r.peerId === peerId)) return prev
        return [...prev, { peerId, stream }]
      })
    }
    peerManager.onRemoteScreenShare = (peerId, stream) => {
      setRemoteScreenShares((prev) => {
        if (stream === null) return prev.filter((r) => r.peerId !== peerId)
        if (prev.find((r) => r.peerId === peerId)) {
          return prev.map((r) => (r.peerId === peerId ? { peerId, stream } : r))
        }
        return [...prev, { peerId, stream }]
      })
    }
    peerManager.onPeerLeft = (peerId) => {
      setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId))
      setRemoteScreenShares((prev) => prev.filter((r) => r.peerId !== peerId))
    }

    return () => {
      peerManager.close()
    }
  }, [localStream, channel, iceServers])

  const startScreenShare = useCallback(async () => {
    if (!peerManagerRef.current) return
    await peerManagerRef.current.startScreenShare()
    setIsScreenSharing(true)
  }, [])

  const stopScreenShare = useCallback(() => {
    peerManagerRef.current?.stopScreenShare()
    setIsScreenSharing(false)
  }, [])

  return { remoteStreams, remoteScreenShares, isScreenSharing, startScreenShare, stopScreenShare }
}
