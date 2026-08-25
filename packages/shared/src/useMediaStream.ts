import { useEffect, useRef, useState } from "react"

export function useMediaStream(): { localStream: MediaStream | null; error: Error | null } {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const setupDone = useRef(false)

  useEffect(() => {
    if (setupDone.current) return
    setupDone.current = true

    let stream: MediaStream

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setLocalStream(stream)
      } catch (err) {
        setError(err as Error)
      }
    }

    setup()
    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return { localStream, error }
}
