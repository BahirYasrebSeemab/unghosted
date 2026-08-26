// WebRTC via Metered's dedicated infrastructure (@metered-ca/realtime).
// Metered owns all signaling, TURN credential delivery, ICE restart, and
// perfect-negotiation — nothing here talks to the Go backend for WebRTC
// purposes.  The Go WS connection (RoomChannel) is kept separately in each
// app purely for the monitoring event stream (event / monitor_status /
// risk_score / room_control messages).
//
// Streams are distinguished by the `role` metadata passed to addStream():
//   "camera" — the participant's webcam+mic (first stream per peer)
//   "screen" — a later-added screen-share stream
// The remote side receives the same metadata on stream-added, so we can
// route each arriving stream to remoteStreams vs remoteScreenShares without
// any out-of-band signaling.

import { useCallback, useEffect, useRef, useState } from "react"
import { MeteredPeer } from "@metered-ca/realtime"

export interface RemoteStream {
  peerId: string
  stream: MediaStream
}

export function useWebRTC(
  meteredApiKey: string,
  roomId: string,
  participantName: string,
  localStream: MediaStream | null,
) {
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
  const [remoteScreenShares, setRemoteScreenShares] = useState<RemoteStream[]>([])
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const peerRef = useRef<MeteredPeer | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const joined = useRef(false)

  useEffect(() => {
    if (!localStream || joined.current) return
    joined.current = true
    let active = true

    const peer = new MeteredPeer({ apiKey: meteredApiKey })
    peerRef.current = peer

    // Add camera+mic before joining so negotiation begins with tracks already present.
    peer.addStream(localStream, { role: "camera", participantName })

    peer.on("peer-joined", ({ peer: remote }: { peer: any }) => {
      remote.on("stream-added", ({ stream, metadata }: { stream: MediaStream; metadata?: { role?: string } }) => {
        if (metadata?.role === "screen") {
          setRemoteScreenShares((prev) => {
            if (prev.find((r) => r.peerId === remote.id)) return prev
            return [...prev, { peerId: remote.id, stream }]
          })
        } else {
          setRemoteStreams((prev) => {
            if (prev.find((r) => r.peerId === remote.id)) return prev
            return [...prev, { peerId: remote.id, stream }]
          })
        }
      })

      remote.on("stream-removed", ({ stream, metadata }: { stream: MediaStream; metadata?: { role?: string } }) => {
        if (metadata?.role === "screen") {
          setRemoteScreenShares((prev) => prev.filter((r) => r.stream !== stream))
        }
      })
    })

    peer.on("peer-left", ({ peer: remote }: { peer: any }) => {
      setRemoteStreams((prev) => prev.filter((r) => r.peerId !== remote.id))
      setRemoteScreenShares((prev) => prev.filter((r) => r.peerId !== remote.id))
    })

    peer.join(roomId).catch((err) => {
      // Suppress errors from intentional closes (StrictMode remounts, navigation).
      if (active) console.error("MeteredPeer join failed:", err)
    })

    return () => {
      active = false
      void peer.close()
      joined.current = false
      peerRef.current = null
    }
  }, [localStream, meteredApiKey, roomId, participantName])

  const startScreenShare = useCallback(async () => {
    if (!peerRef.current) return
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    screenStreamRef.current = screenStream
    peerRef.current.addStream(screenStream, { role: "screen" })
    setIsScreenSharing(true)

    screenStream.getVideoTracks()[0].addEventListener("ended", () => {
      stopScreenShare()
    }, { once: true })
  }, [])

  const stopScreenShare = useCallback(() => {
    const stream = screenStreamRef.current
    if (!stream) return
    if (peerRef.current) {
      peerRef.current.removeStream?.(stream)
    }
    stream.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)
  }, [])

  return { remoteStreams, remoteScreenShares, isScreenSharing, startScreenShare, stopScreenShare }
}