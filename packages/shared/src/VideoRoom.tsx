// Shared between both apps — an interviewer joining a room is just another
// peer in the Metered channel, so this component doesn't need to know or care
// which app it's rendered in.
//
// WebRTC is fully delegated to @metered-ca/realtime via useWebRTC — no Go
// backend connection happens here.  The Go WS (RoomChannel) is used elsewhere
// in each app for the monitoring event stream only.

import { useState } from "react"
import { Controls } from "./Controls"
import { VideoGrid } from "./VideoGrid"
import { VideoTile } from "./VideoTile"
import { useMediaStream } from "./useMediaStream"
import { useWebRTC } from "./useWebRTC"

export default function VideoRoom({
  meteredApiKey,
  roomId,
  participantName,
  onLeave,
}: {
  meteredApiKey: string
  roomId: string
  participantName: string
  onLeave?: () => void
}) {
  const { localStream, error } = useMediaStream()
  const [joined, setJoined] = useState(false)

  if (error) {
    return (
      <div className="text-sm text-[var(--color-critical,#e5484d)]">
        Camera/microphone access failed: {error.message}
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="space-y-3 max-w-xs">
        <VideoTile stream={localStream} label="You" isLocal />
        <button
          type="button"
          onClick={() => setJoined(true)}
          disabled={!localStream}
          className="w-full px-3 py-1.5 text-xs font-medium rounded border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50"
        >
          {localStream ? "Join call" : "Waiting for camera…"}
        </button>
      </div>
    )
  }

  return (
    <ConnectedCall
      meteredApiKey={meteredApiKey}
      roomId={roomId}
      participantName={participantName}
      localStream={localStream}
      onLeave={onLeave}
    />
  )
}

function ConnectedCall({
  meteredApiKey,
  roomId,
  participantName,
  localStream,
  onLeave,
}: {
  meteredApiKey: string
  roomId: string
  participantName: string
  localStream: MediaStream | null
  onLeave?: () => void
}) {
  const { remoteStreams, remoteScreenShares, isScreenSharing, startScreenShare, stopScreenShare } = useWebRTC(
    meteredApiKey,
    roomId,
    participantName,
    localStream,
  )
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  const toggleAudio = () => {
    const next = !isAudioEnabled
    localStream?.getAudioTracks().forEach((track) => (track.enabled = next))
    setIsAudioEnabled(next)
  }

  const toggleVideo = () => {
    const next = !isVideoEnabled
    localStream?.getVideoTracks().forEach((track) => (track.enabled = next))
    setIsVideoEnabled(next)
  }

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      startScreenShare().catch((err) => console.error("Failed to start screen share:", err))
    }
  }

  return (
    <div>
      <VideoGrid
        localStream={localStream}
        remoteStreams={remoteStreams}
        remoteScreenShares={remoteScreenShares}
        isAudioMuted={!isAudioEnabled}
      />
      <Controls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        onLeave={onLeave}
      />
    </div>
  )
}
