// Fetches short-lived TURN credentials from Metered so calls can traverse symmetric NAT /
// restrictive corporate firewalls — STUN alone (see peerManager.ts's default) fails there.
// Falls back to STUN-only if Metered is unreachable or unconfigured, so the call still works on
// networks that don't need TURN.

import { useEffect, useState } from "react"

export function useTurnCredentials(): RTCIceServer[] | null {
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCredentials() {
      const domain = import.meta.env.VITE_TURN_DOMAIN
      const apiKey = import.meta.env.VITE_TURN_API_KEY

      if (!domain || !apiKey) {
        if (!cancelled) setIceServers([{ urls: "stun:stun.l.google.com:19302" }])
        return
      }

      try {
        const response = await fetch(`${domain}/api/v1/turn/credentials?apiKey=${apiKey}`)
        if (!response.ok) throw new Error(`TURN credentials request failed: ${response.status}`)
        const servers = (await response.json()) as RTCIceServer[]
        if (!cancelled) setIceServers(servers)
      } catch (err) {
        console.error("Failed to fetch TURN credentials:", err)
        if (!cancelled) setIceServers([{ urls: "stun:stun.l.google.com:19302" }])
      }
    }

    fetchCredentials()
    return () => {
      cancelled = true
    }
  }, [])

  return iceServers
}
