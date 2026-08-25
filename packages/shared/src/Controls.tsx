export function Controls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onLeave?: () => void
}) {
  const buttonClass =
    "px-3 py-1.5 text-xs font-medium rounded border border-border bg-card text-foreground hover:bg-muted"

  return (
    <div className="flex items-center gap-2 mt-3">
      <button type="button" onClick={onToggleAudio} className={buttonClass}>
        {isAudioEnabled ? "Mute" : "Unmute"}
      </button>
      <button type="button" onClick={onToggleVideo} className={buttonClass}>
        {isVideoEnabled ? "Camera off" : "Camera on"}
      </button>
      {onLeave && (
        <button
          type="button"
          onClick={onLeave}
          className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-[var(--color-critical,#e5484d)] text-white hover:opacity-90"
        >
          Leave
        </button>
      )}
    </div>
  )
}
