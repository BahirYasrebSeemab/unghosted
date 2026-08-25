import { VideoTile } from "./VideoTile"
import type { RemoteStream } from "./peerManager"

export function VideoGrid({
  localStream,
  remoteStreams,
  isAudioMuted,
}: {
  localStream: MediaStream | null
  remoteStreams: RemoteStream[]
  isAudioMuted: boolean
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <VideoTile stream={localStream} label="You" isLocal isMuted={isAudioMuted} />
      {remoteStreams.map((peer) => (
        <VideoTile key={peer.peerId} stream={peer.stream} label={`Peer ${peer.peerId.slice(0, 6)}`} />
      ))}
    </div>
  )
}
