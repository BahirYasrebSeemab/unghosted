import { useEffect, useRef } from "react"

export function VideoTile({
  stream,
  label,
  isLocal = false,
  isMuted = false,
}: {
  stream: MediaStream | null
  label: string
  isLocal?: boolean
  isMuted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative bg-card border border-border rounded overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-xs rounded bg-background/70 text-foreground flex items-center gap-1.5">
        {label}
        {isMuted && <span className="text-[var(--color-critical,#e5484d)]">muted</span>}
      </div>
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Connecting…
        </div>
      )}
    </div>
  )
}
