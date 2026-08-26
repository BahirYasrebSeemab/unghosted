import { Button } from "./components/ui/button"

export function Controls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  isScreenSharing,
  onToggleScreenShare,
  onLeave,
}: {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  isScreenSharing?: boolean
  onToggleScreenShare?: () => void
  onLeave?: () => void
}) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <Button type="button" variant="outline" size="sm" onClick={onToggleAudio}>
        {isAudioEnabled ? "Mute" : "Unmute"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onToggleVideo}>
        {isVideoEnabled ? "Camera off" : "Camera on"}
      </Button>
      {onToggleScreenShare && (
        <Button
          type="button"
          size="sm"
          variant={isScreenSharing ? "default" : "outline"}
          onClick={onToggleScreenShare}
        >
          {isScreenSharing ? "Stop sharing" : "Share screen"}
        </Button>
      )}
      {onLeave && (
        <Button type="button" variant="destructive" size="sm" onClick={onLeave}>
          Leave
        </Button>
      )}
    </div>
  )
}
