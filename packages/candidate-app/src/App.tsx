import { useState, useEffect, useRef, useCallback } from "react"
import { ConcentrationMonitor, type ConcentrationReading } from "./concentrationMonitor"
import { scanWindows } from "../electron/windowScanner";
import { AuthGate, decodeJwtSub } from "./Auth"

import { VideoRoom, type BackendRoom, Button, Input, Card, Badge, Separator } from "@unghosted/shared";

type Severity = "info" | "warning" | "critical"

interface AlertEvent {
  id: string
  timestamp: Date
  category: string
  message: string
  severity: Severity
}

interface MonitorState {
  status: "active" | "warning" | "critical" | "offline"
  value: string
  count: number
}

type Monitors = {
  tabFocus: MonitorState
  audio: MonitorState
  gaze: MonitorState
  mouse: MonitorState
  clipboard: MonitorState
  keyboard: MonitorState
  process: MonitorState
}

const SESSION_ID = "INT-" + Math.floor(2800 + Math.random() * 200)
const CANDIDATE = "Alex Morgan"
const ROLE = "Senior Software Engineer"

// RiskGauge/MonitorCard/EventLog moved to packages/shared/src/components/dashboard — the
// candidate is not shown their own risk/monitoring dashboard (that's the interviewer's view now,
// see interviewer-app/src/App.tsx). The events/monitors/riskScore *state* below is unchanged and
// still drives the underlying detection — only its visualization moved.

function ScreenCaptureFeed({
  hasPermission,
  onPermission,
}: {
  hasPermission: boolean
  onPermission: (stream: MediaStream) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getDisplayMedia({ video: { frameRate: 5 }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        onPermission(s)
        if (!videoRef.current) return
        videoRef.current.srcObject = s
        await videoRef.current.play()

        // If the candidate stops sharing via the browser/OS's own
        // "Stop sharing" control, the track ends on its own — reflect
        // that in the UI rather than silently going stale.
        s.getVideoTracks()[0]?.addEventListener('ended', () => {
          setError('Screen sharing stopped')
        })
      })
      .catch((err) => {
        console.error(err.message)
        setError(err?.message ?? 'Screen share permission denied')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onPermission])

  return (
    <div className="relative overflow-hidden bg-muted aspect-video border border-border">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-contain ${hasPermission ? 'block' : 'hidden'}`}
      />
      {!hasPermission && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-4xl opacity-20">🖥</span>
          <span className="text-xs text-muted-foreground font-mono">
            {error ? error : 'Awaiting screen share permission'}
          </span>
        </div>
      )}
      {hasPermission && (
        <>
          <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-primary/40" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-primary/40" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-primary/40" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-primary/40" />
          <div className="absolute top-2 left-2 text-[9px] font-mono text-primary pl-6">SCREEN</div>
        </>
      )}
    </div>
  )
}

/**
 * WebcamFeed now owns the ConcentrationMonitor lifecycle and reports every
 * new reading upward via `onReading`, instead of keeping it to itself.
 * `gazeDeviation` (for the crosshair) is derived from that same reading in
 * the parent, so the crosshair and the real detection numbers can never
 * drift apart the way they could when gaze was simulated separately.
 */
function WebcamFeed({
  gazeDeviation,
  hasPermission,
  onPermission,
  onReading,
}: {
  gazeDeviation: { x: number; y: number } | null
  hasPermission: boolean
  onPermission: (stream: MediaStream) => void
  onReading: (reading: ConcentrationReading) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const monitorRef = useRef<ConcentrationMonitor | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the latest onReading in a ref so the effect below doesn't need to
  // re-run (and re-request the camera / rebuild the monitor) every time the
  // parent re-renders with a new callback identity.
  const onReadingRef = useRef(onReading)
  useEffect(() => {
    onReadingRef.current = onReading
  }, [onReading])

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        onPermission(s)
        if (!videoRef.current) return

        videoRef.current.srcObject = s
        await videoRef.current.play()

        const monitor = new ConcentrationMonitor({
          videoEl: videoRef.current,
          mountOverlayTo: null, // we render our own UI from `reading` instead
        })
        monitorRef.current = monitor

        monitor.onUpdate((reading) => onReadingRef.current(reading))
        await monitor.start()
      })
      .catch((err) => {
        console.error(err.message);
        setError(err?.message ?? "Camera access denied")})

    return () => {
      cancelled = true
      monitorRef.current?.stop()
      monitorRef.current = null
      stream?.getTracks().forEach((t) => t.stop())
    }
    // Only re-run if the permission callback identity changes; monitor
    // creation/teardown should not restart on every parent re-render.
  }, [onPermission])

  if (error) {
    console.error(error)
  }

  return (
    <div className="relative overflow-hidden bg-muted aspect-video border border-border">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover scale-x-[-1] ${
            hasPermission ? "block" : "hidden"
          }`}
        />
        { !hasPermission && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-4xl opacity-20">📷</span>
            <span className="text-xs text-muted-foreground font-mono">
              {error ? error : "Awaiting camera permission"}
            </span>
          </div>
        )}

      {/* Gaze crosshair overlay */}
      {gazeDeviation && hasPermission && (
        <div
          className="absolute w-6 h-6 pointer-events-none transition-all duration-150"
          style={{
            left: `calc(50% + ${gazeDeviation.x}px - 12px)`,
            top: `calc(50% + ${gazeDeviation.y}px - 12px)`,
          }}
        >
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <circle cx="12" cy="12" r="8" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.8" />
            <line x1="12" y1="2" x2="12" y2="8" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.8" />
            <line x1="12" y1="16" x2="12" y2="22" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.8" />
            <line x1="2" y1="12" x2="8" y2="12" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.8" />
            <line x1="16" y1="12" x2="22" y2="12" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.8" />
          </svg>
        </div>
      )}

      {/* Corner brackets */}
      {hasPermission && (
        <>
          <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-primary/40" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-primary/40" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-primary/40" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-primary/40" />
          <div className="absolute top-2 left-2 text-[9px] font-mono text-primary pl-6">LIVE</div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [events, setEvents] = useState<AlertEvent[]>([])
  // The score itself is no longer read here — the candidate isn't shown their own risk score
  // (that dashboard moved to interviewer-app/src/App.tsx) — but setRiskScore still drives it
  // internally via addEvent below, so the state stays; the unused getter slot is just skipped.
  const [, setRiskScore] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [hasCamera, setHasCamera] = useState(false)
  const [gazeDeviation, setGazeDeviation] = useState<{ x: number; y: number } | null>(null)
  const [monitors, setMonitors] = useState<Monitors>({
    tabFocus: { status: "active", value: "In focus", count: 0 },
    audio: { status: "offline", value: "Awaiting mic", count: 0 },
    gaze: { status: "offline", value: "Awaiting camera", count: 0 },
    mouse: { status: "active", value: "On screen", count: 0 },
    clipboard: { status: "active", value: "No activity", count: 0 },
    keyboard: { status: "active", value: "Normal cadence", count: 0 },
    process: { status: "active", value: "No hidden apps", count: 0 }
  })
  const [isSessionActive, setIsSessionActive] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioAnimFrameRef = useRef<number>(0)
  const keystrokesRef = useRef<number[]>([])
  const lastKeystrokeRef = useRef<number>(0)
  const gazeAlertCooldownRef = useRef(0);

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const handleLogin = useCallback((token: string) => {
    setAccessToken(token)
    setUserEmail(decodeJwtSub(token))
  }, [])

  const [roomSession, setRoomSession] = useState<{ roomId: string; token: string } | null>(null)
  const [roomIdInput, setRoomIdInput] = useState("")
  const [roomPreview, setRoomPreview] = useState<BackendRoom | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  const handleLookupRoom = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!accessToken) return
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const room = await window.ipcRenderer.getRoom(accessToken, roomIdInput.trim())
        setRoomPreview(room)
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Could not find that room")
      } finally {
        setPreviewLoading(false)
      }
    },
    [accessToken, roomIdInput],
  )

  const handleAskToJoin = useCallback(async () => {
    if (!accessToken || !roomPreview) return
    setRequesting(true)
    setPreviewError(null)
    try {
      const room = await window.ipcRenderer.requestJoin(accessToken, roomPreview.id)
      setRoomPreview(room)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not send join request")
    } finally {
      setRequesting(false)
    }
  }, [accessToken, roomPreview])

  // Waits on the interviewer's accept/reject — the room ws is only opened once join_status
  // flips to "accepted" (see the roomSession effect below).
  useEffect(() => {
    if (!accessToken || !roomPreview) return
    if (roomPreview.join_status !== "requested") return

    const roomId = roomPreview.id
    const interval = setInterval(async () => {
      try {
        const room = await window.ipcRenderer.getRoom(accessToken, roomId)
        setRoomPreview(room)
      } catch {
        // transient poll failure — try again next tick
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [accessToken, roomPreview])

  useEffect(() => {
    if (accessToken && roomPreview?.join_status === "accepted" && !roomSession) {
      setRoomSession({ roomId: roomPreview.id, token: accessToken })
    }
  }, [accessToken, roomPreview, roomSession])

  const [hasScreen, setHasScreen] = useState(false);
  
  const handleScreenPermission = useCallback((_stream: MediaStream) => {
    setHasScreen(true);
  }, [])

  const addEvent = useCallback((category: string, message: string, severity: Severity) => {
    const ev: AlertEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category,
      message,
      severity,
    }
    setEvents((prev) => [...prev.slice(-99), ev])
    setRiskScore((prev) => {
      const delta = severity === "critical" ? 15 : severity === "warning" ? 6 : 1
      return Math.min(100, prev + delta)
    })
    setMonitors((prev) => {
      const key =
        category === "TAB" || category === "FOCUS"
          ? "tabFocus"
          : category === "AUDIO"
            ? "audio"
            : category === "GAZE"
              ? "gaze"
              : category === "MOUSE"
                ? "mouse"
                : category === "CLIPBOARD"
                  ? "clipboard"
                  : category === "KEYBOARD"
                    ? "keyboard"
                    : category === "PROCESS"
                      ? "process"
                      : null
      if (!key) return prev
      return {
        ...prev,
        [key]: {
          ...prev[key],
          status: severity === "critical" ? "critical" : severity === "warning" ? "warning" : prev[key].status,
          count: prev[key].count + 1,
          value: message,
        },
      }
    })
  }, [])

  // Session timer
  useEffect(() => {
    if (!isSessionActive) return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isSessionActive])

  // Tab visibility detection
  useEffect(() => {
    if (!isSessionActive) return
    const handleVisibility = () => {
      if (document.hidden) {
        addEvent("TAB", "Candidate switched away from interview tab", "critical")
        setMonitors((p) => ({ ...p, tabFocus: { ...p.tabFocus, status: "critical", value: "Tab hidden" } }))
      } else {
        setMonitors((p) => ({ ...p, tabFocus: { ...p.tabFocus, status: "warning", value: "Tab restored" } }))
        addEvent("TAB", "Candidate returned to interview tab", "warning")
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [isSessionActive, addEvent])

  // Window focus/blur detection
  useEffect(() => {
    if (!isSessionActive) return
    const handleBlur = () => {
      addEvent("FOCUS", "Interview window lost focus — possible external tool usage", "critical")
      setMonitors((p) => ({ ...p, tabFocus: { ...p.tabFocus, status: "critical", value: "Window unfocused" } }))
    }
    const handleFocus = () => {
      setMonitors((p) => ({ ...p, tabFocus: { ...p.tabFocus, status: "active", value: "In focus" } }))
    }
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    return () => {
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
    }
  }, [isSessionActive, addEvent])

  // Mouse leave detection
  useEffect(() => {
    if (!isSessionActive) return
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    const handleLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        leaveTimer = setTimeout(() => {
          addEvent("MOUSE", "Cursor left interview window — possible second monitor or overlay", "warning")
          setMonitors((p) => ({ ...p, mouse: { ...p.mouse, status: "warning", value: "Off screen" } }))
        }, 800)
      }
    }
    const handleEnter = () => {
      if (leaveTimer) clearTimeout(leaveTimer)
      setMonitors((p) => ({ ...p, mouse: { ...p.mouse, status: "active", value: "On screen" } }))
    }
    document.addEventListener("mouseleave", handleLeave)
    document.addEventListener("mouseenter", handleEnter)
    return () => {
      document.removeEventListener("mouseleave", handleLeave)
      document.removeEventListener("mouseenter", handleEnter)
      if (leaveTimer) clearTimeout(leaveTimer)
    }
  }, [isSessionActive, addEvent])

  // Clipboard monitoring
  useEffect(() => {
    if (!isSessionActive) return
    const handleCopy = () => {
      addEvent("CLIPBOARD", "Text copied to clipboard during interview session", "warning")
    }
    const handlePaste = () => {
      addEvent("CLIPBOARD", "Paste detected — content may be sourced externally", "critical")
      setMonitors((p) => ({
        ...p,
        clipboard: { ...p.clipboard, status: "critical", value: "Paste detected", count: p.clipboard.count + 1 },
      }))
    }
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
    }
  }, [isSessionActive, addEvent])

  // Keyboard cadence analysis
  useEffect(() => {
    if (!isSessionActive) return
    const handleKey = () => {
      const now = Date.now()
      if (lastKeystrokeRef.current) {
        const gap = now - lastKeystrokeRef.current
        keystrokesRef.current = [...keystrokesRef.current.slice(-19), gap]

        const recent = keystrokesRef.current.slice(-5)
        if (recent.length === 5 && recent.every((g) => g < 30)) {
          addEvent("KEYBOARD", "Unusually fast keystroke burst — possible programmatic input", "critical")
          setMonitors((p) => ({ ...p, keyboard: { ...p.keyboard, status: "critical", value: "Burst detected" } }))
        }

        if (gap > 8000 && keystrokesRef.current.length > 3) {
          addEvent("KEYBOARD", `${(gap / 1000).toFixed(1)}s inactivity gap — possible external lookup`, "warning")
          setMonitors((p) => ({ ...p, keyboard: { ...p.keyboard, status: "warning", value: `${(gap / 1000).toFixed(1)}s pause` } }))
        }
      }
      lastKeystrokeRef.current = now
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isSessionActive, addEvent])

  // process monitoring
  useEffect(() => {
    if (!isSessionActive) return

      const unsubScan = window.ipcRenderer?.onWindowScan((flagged) => {
	      console.log('[renderer] received window-scan:', flagged);
        flagged.forEach((w) => {
          if (w.type === 'BLACKLISTED_NAME') {
            addEvent('PROCESS', `Blacklisted app detected: "${w.title}" (matched "${w.matchedTerm}")`, 'critical')
          } else {
            addEvent('PROCESS', `Window hidden from screen capture: "${w.title || 'untitled'}"`, 'critical')
          }
        })
      })

      const unsubStatus = window.ipcRenderer?.onWindowScanStatus(({ activeCount }) => {
        setMonitors((p) => ({
          ...p,
          process: {
            ...p.process,
            status: activeCount > 0 ? 'critical' : 'active',
            value: activeCount > 0 ? `${activeCount} active flag${activeCount !== 1 ? 's' : ''}` : 'No hidden apps',
          },
        }))
      })

      return () => {
        unsubScan?.()
        unsubStatus?.()
      }
  }, [isSessionActive, addEvent])

  // Audio monitoring via Web Audio API
  const startAudioMonitoring = useCallback(
    (stream: MediaStream) => {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioContextRef.current = audioCtx
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      let voiceAlertCooldown = 0

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const db = Math.round(avg)

        setMonitors((p) => ({
          ...p,
          audio: {
            ...p.audio,
            status: db > 20 ? "warning" : "active",
            value: db > 20 ? `Voice: ${db} level` : `Silent: ${db} level`,
          },
        }))

        if (db > 25 && Date.now() > voiceAlertCooldown) {
          addEvent("AUDIO", "Voice activity detected — candidate may be speaking to someone", "warning")
          voiceAlertCooldown = Date.now() + 5000
        }

        audioAnimFrameRef.current = requestAnimationFrame(tick)
      }
      audioAnimFrameRef.current = requestAnimationFrame(tick)

      setMonitors((p) => ({ ...p, audio: { ...p.audio, status: "active", value: "Monitoring..." } }))
    },
    [addEvent],
  )

  /**
   * Real gaze/head/blink data from ConcentrationMonitor, replacing the old
   * setInterval + Math.random() simulation. gazeDeviation/headDeviation are
   * 0..1; we scale them into pixel offsets for the crosshair, and drive the
   * "gaze" monitor card + event log off the module's own state machine
   * (focused / distracted / drowsy / away) instead of a hand-rolled distance
   * threshold on fake coordinates.
   */
  const handleReading = useCallback(
    (reading: ConcentrationReading) => {
      if (reading.gazeDeviation > 0.15) reading.state = "distracted";
      if (!isSessionActive) return

      // Scale normalized deviation (0..1) into a crosshair pixel offset.
      const x = (reading.gazeDeviation - 0.15) * 220
      const y = (reading.headDeviation - 0.15) * 140
      setGazeDeviation({ x, y })

      setMonitors((p) => ({
        ...p,
        gaze: {
          ...p.gaze,
          status:
            reading.state === "away" || reading.state === "distracted"
              ? "warning"
              : reading.state === "drowsy"
                ? "warning"
                : "active",
          value:
            reading.state === "away"
              ? "No face detected"
              : reading.state === "drowsy"
                ? "Eyes closing / drowsy"
                : reading.state === "distracted"
                  ? "Gaze off-screen"
                  : "On screen",
        },
      }))

      const now = Date.now()
      if (reading.state !== "focused" && now > gazeAlertCooldownRef.current) {
        const message =
          reading.state === "away"
            ? "Candidate's face not visible — possible away from desk"
            : reading.state === "drowsy"
              ? "Sustained eye closure detected"
              : "Gaze deviated from screen — candidate looking away"
        addEvent("GAZE", message, reading.state === "away" ? "critical" : "warning")
        gazeAlertCooldownRef.current = now + 4000
      }
    },
    [isSessionActive, addEvent],
  )

  const handleCameraPermission = useCallback(
    (_stream: MediaStream) => {
      setHasCamera(true);
      startAudioMonitoring(_stream);
    },
    [startAudioMonitoring],
  );

  const startSession = () => {
    setIsSessionActive(true)
    setEvents([])
    setRiskScore(0)
    setElapsed(0)
    setMonitors({
      tabFocus: { status: "active", value: "Monitoring...", count: 0 },
      audio: { status: "offline", value: "Awaiting mic", count: 0 },
      gaze: { status: "offline", value: "Awaiting camera", count: 0 },
      mouse: { status: "active", value: "Monitoring...", count: 0 },
      clipboard: { status: "active", value: "Clean", count: 0 },
      keyboard: { status: "active", value: "Normal", count: 0 },
      process: { status: "active", value: "Normal", count: 0 },
    })
    window.ipcRenderer?.startSessionScan()
    window.ipcRenderer?.enterKioskMode()
  }

  const stopSession = async () => {
    setIsSessionActive(false);
    window.ipcRenderer?.exitKioskMode()

    if (audioAnimFrameRef.current) {
      cancelAnimationFrame(audioAnimFrameRef.current)
      audioAnimFrameRef.current = 0;
    }

    const ctx = audioContextRef.current;

    if (ctx && ctx.state !== "closed") {
      await ctx.close();
    }

    audioContextRef.current = null;
    analyserRef.current = null;

    setGazeDeviation(null);

    setHasScreen(false);
    setHasCamera(false);
  }

  const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  const criticalCount = events.filter((e) => e.severity === "critical").length
  const warningCount = events.filter((e) => e.severity === "warning").length

  if (!accessToken) {
    return <AuthGate onLogin={handleLogin} />
  }

  if (!roomSession) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Join Interview</h1>
            <p className="text-sm text-muted-foreground">Paste the room ID from the link your interviewer sent you.</p>
          </div>

          {!roomPreview && (
            <form onSubmit={handleLookupRoom} className="space-y-4">
              <Input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Room ID"
                className="text-center font-mono tracking-widest"
                autoFocus
              />
              {previewError && <p className="text-sm text-destructive text-center">{previewError}</p>}
              <Button type="submit" disabled={previewLoading || !roomIdInput.trim()} className="w-full">
                {previewLoading ? "Looking up…" : "Find room"}
              </Button>
            </form>
          )}

          {roomPreview && roomPreview.join_status !== "requested" && (
            <div className="space-y-4">
              <Card className="px-3 py-3 text-sm text-center space-y-1">
                <p className="text-foreground">{roomPreview.candidate_name}</p>
                <p className="text-muted-foreground">{roomPreview.role}</p>
              </Card>
              {previewError && <p className="text-sm text-destructive text-center">{previewError}</p>}
              {roomPreview.join_status === "rejected" && (
                <p className="text-sm text-[var(--color-warning)] text-center">Your last request was declined.</p>
              )}
              <Button type="button" onClick={handleAskToJoin} disabled={requesting} className="w-full">
                {requesting ? "Sending…" : "Ask to Join"}
              </Button>
              <Button type="button" variant="link" onClick={() => setRoomPreview(null)} className="w-full">
                Look up a different room
              </Button>
            </div>
          )}

          {roomPreview && roomPreview.join_status === "requested" && (
            <div className="space-y-2 text-center">
              <Card className="px-3 py-3 text-sm space-y-1">
                <p className="text-foreground">{roomPreview.candidate_name}</p>
                <p className="text-muted-foreground">{roomPreview.role}</p>
              </Card>
              <p className="text-sm text-muted-foreground">Waiting for the interviewer to let you in…</p>
            </div>
          )}

          {userEmail && (
            <p className="text-xs text-center text-muted-foreground">
              Signed in as {userEmail}.{" "}
              <button type="button" onClick={() => setAccessToken(null)} className="underline underline-offset-2">
                Sign out
              </button>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 lg:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">P</span>
          </div>
          <div>
            <span className="font-semibold text-foreground tracking-tight">UnGhosted</span>
            <span className="ml-2 text-xs font-mono text-muted-foreground">v2.4.1</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>SESSION</span>
            <span className="text-primary">{SESSION_ID}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${isSessionActive ? "bg-[var(--color-signal)] animate-pulse" : "bg-muted-foreground"}`} />
            <span className={isSessionActive ? "text-[var(--color-signal)]" : "text-muted-foreground"}>
              {isSessionActive ? elapsedStr : "IDLE"}
            </span>
          </div>
          <Button
            onClick={isSessionActive ? stopSession : startSession}
            variant={isSessionActive ? "destructive" : "default"}
            size="sm"
          >
            {isSessionActive ? "End session" : "Start session"}
          </Button>
        </div>
      </header>

      {/* Candidate Info Bar */}
      <Card className="flex flex-wrap items-center gap-4 mb-5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary flex items-center justify-center text-sm font-semibold text-primary">
            {CANDIDATE.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{CANDIDATE}</div>
            <div className="text-xs text-muted-foreground font-mono">{ROLE}</div>
          </div>
        </div>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        {criticalCount > 0 && <Badge variant="critical">{criticalCount} critical alert{criticalCount !== 1 ? "s" : ""}</Badge>}
        {warningCount > 0 && <Badge variant="warning">{warningCount} warning{warningCount !== 1 ? "s" : ""}</Badge>}
        {!isSessionActive && (
          <div className="text-xs font-mono text-muted-foreground ml-auto">Session not started</div>
        )}
      </Card>

      {/* Main Layout — single column: the risk/monitoring dashboard that used to sit in a right
          column here now lives on the interviewer side only (see interviewer-app/src/App.tsx). */}
      <div className="max-w-xl mx-auto">
        {/* Webcam + Gaze */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Camera Feed</span>
              {hasCamera && isSessionActive && (
                <span className="text-xs font-mono text-[var(--color-warning)]">Eye tracking active</span>
              )}
            </div>
            <WebcamFeed
              gazeDeviation={isSessionActive ? gazeDeviation : null}
              hasPermission={hasCamera}
              onPermission={handleCameraPermission}
              onReading={handleReading}
            />

            {roomSession && (
              <VideoRoom
                meteredApiKey={import.meta.env.VITE_METERED_API_KEY ?? ""}
                roomId={roomSession.roomId}
                participantName={userEmail ?? "Candidate"}
              />
            )}
            <div>
            <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Screen Feed</span>
            {hasScreen && <span className="text-xs font-mono text-[var(--color-warning)]">Recording</span>}
            </div>
            {isSessionActive ? (
              <ScreenCaptureFeed hasPermission={hasScreen} onPermission={handleScreenPermission} />
            ) : (
            <div className="bg-muted aspect-video border border-border flex items-center justify-center text-xs text-muted-foreground font-mono">
            Starts with session
            </div>
            )}
            </div>
          </div>

          {/* Gaze heatmap legend */}
          {hasCamera && isSessionActive && (
            <Card className="p-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Gaze Analysis</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Deviations", value: monitors.gaze.count.toString(), color: "text-[var(--color-warning)]" },
                  { label: "Status", value: monitors.gaze.value, color: monitors.gaze.status === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-signal)]" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{item.label}</span>
                    <span className={`text-xs font-mono font-medium ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Detection method note */}
          <Card className="p-3">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Detection Coverage</div>
            <div className="space-y-1.5">
              {[
                { label: "Ghost overlay tools", note: "Focus/blur + mouse tracking (gaze cannot see on-screen content)" },
                { label: "Phone / 2nd device", note: "Gaze deviation + voice" },
                { label: "Pre-typed answers", note: "Keyboard cadence analysis" },
                { label: "Browser tab switch", note: "Visibility API" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground text-right">{item.note}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">
          Unghosted • Browser-native behavioral analysis
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          Tab API · Web Audio API · Gaze estimation · Keyboard heuristics
        </span>
      </footer>
    </div>
  )
}

