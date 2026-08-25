import { useEffect, useState } from "react"
import { RoomChannel } from "./roomChannel"

export function useSignaling(wsBaseUrl: string, roomId: string, token: string): { channel: RoomChannel | null } {
  const [channel, setChannel] = useState<RoomChannel | null>(null)

  useEffect(() => {
    let cancelled = false
    const room = new RoomChannel(wsBaseUrl, roomId, token)

    room
      .waitUntilOpen()
      .then(() => {
        if (cancelled) {
          room.close() // effect cleaned up mid-connect — close once open instead of leaking
        } else {
          setChannel(room)
        }
      })
      .catch(() => {
        // connection failed before opening — nothing to clean up, useWebRTC just stays unwired
      })

    return () => {
      cancelled = true
      room.close()
    }
  }, [wsBaseUrl, roomId, token])

  return { channel }
}
