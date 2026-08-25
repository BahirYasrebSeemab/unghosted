import { VideoTile } from "./VideoTile"
import type { RemoteStream } from "./peerManager"

export function VideoGrid({
  localStream,
  remoteStreams,
  remoteScreenShares = [],
  isAudioMuted,
}: {
  localStream: MediaStream | null
  remoteStreams: RemoteStream[]
  remoteScreenShares?: RemoteStream[]
  isAudioMuted: boolean
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <VideoTile stream={localStream} label="You" isLocal isMuted={isAudioMuted} />
      {remoteStreams.map((peer) => (
        <VideoTile key={peer.peerId} stream={peer.stream} label={`Peer ${peer.peerId.slice(0, 6)}`} />
      ))}
      {remoteScreenShares.map((peer) => (
        <VideoTile
          key={`${peer.peerId}-screen`}
          stream={peer.stream}
          label={`Peer ${peer.peerId.slice(0, 6)} — Screen`}
        />
      ))}
    </div>
  )
}
