import { useState, useEffect, useRef, useCallback } from "react"
import { ConcentrationMonitor, type ConcentrationReading } from "./concentrationMonitor"
import { scanWindows } from "../electron/windowScanner";
import { AuthGate, decodeJwtSub } from "./Auth"

import { VideoRoom, type BackendRoom } from "@unghosted/shared";

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

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function RiskGauge({ score }: { score: number }) {
  const color = score < 25 ? "#22c55e" : score < 60 ? "#f59e0b" : "#ef4444"
  const label = score < 25 ? "LOW RISK" : score < 60 ? "ELEVATED" : "HIGH RISK"
  const circumference = 2 * Math.PI * 52
  const arc = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1e2230" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-500 font-mono">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-mono font-medium tracking-widest" style={{ color }}>{label}</span>
    </div>
  )
}

function MonitorCard({
  icon,
  label,
  monitor,
}: {
  icon: string
  label: string
  monitor: MonitorState
}) {
  const colors = {
    active: { dot: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-900/40" },
    warning: { dot: "bg-amber-500", text: "text-amber-400", border: "border-amber-900/50" },
    critical: { dot: "bg-red-500 animate-pulse", text: "text-red-400", border: "border-red-900/50" },
    offline: { dot: "bg-slate-600", text: "text-slate-500", border: "border-slate-800" },
  }
  const c = colors[monitor.status]

  return (
    <div
      className={`rounded-lg border bg-[#0f1117] p-3 flex flex-col gap-2 transition-all duration-300 ${c.border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">{label}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      </div>
      <div className={`text-xs font-mono ${c.text} truncate`}>{monitor.value}</div>
      {monitor.count > 0 && (
        <div className="text-xs text-slate-600 font-mono">{monitor.count} event{monitor.count !== 1 ? "s" : ""}</div>
      )}
    </div>
  )
}

function EventLog({ events }: { events: AlertEvent[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [events.length])

  const sev = {
    info: { tag: "bg-slate-700 text-slate-300", dot: "bg-slate-500" },
    warning: { tag: "bg-amber-900/60 text-amber-300", dot: "bg-amber-400" },
    critical: { tag: "bg-red-900/60 text-red-300", dot: "bg-red-500" },
  }

  return (
    <div ref={ref} className="h-56 overflow-y-auto space-y-1 pr-1">
      {events.length === 0 && (
        <div className="flex items-center justify-center h-full text-slate-600 text-xs font-mono">
          No events detected
        </div>
      )}
      {events.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 py-2 px-3 rounded-md bg-[#0a0d14] border border-[#1e2230]/60 hover:border-[#2a3050] transition-colors"
        >
          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sev[e.severity].dot}`} />
          <span className="text-xs font-mono text-slate-500 flex-shrink-0 w-20">{formatTime(e.timestamp)}</span>
          <span
            className={`text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${sev[e.severity].tag}`}
          >
            {e.category}
          </span>
          <span className="text-xs text-slate-300 flex-1">{e.message}</span>
        </div>
      ))}
    </div>
  )
}

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
    <div className="relative rounded-lg overflow-hidden bg-[#080b12] aspect-video border border-[#1e2230]">
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
          <span className="text-xs text-slate-600 font-mono">
            {error ? error : 'Awaiting screen share permission'}
          </span>
        </div>
      )}
      {hasPermission && (
        <>
          <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-amber-500/40" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-amber-500/40" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-amber-500/40" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-amber-500/40" />
          <div className="absolute top-2 left-2 text-[9px] font-mono text-amber-600 pl-6">SCREEN</div>
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
    <div className="relative rounded-lg overflow-hidden bg-[#080b12] aspect-video border border-[#1e2230]">
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
            <span className="text-xs text-slate-600 font-mono">
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
            <circle cx="12" cy="12" r="8" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
            <line x1="12" y1="2" x2="12" y2="8" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
            <line x1="12" y1="16" x2="12" y2="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
            <line x1="2" y1="12" x2="8" y2="12" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
            <line x1="16" y1="12" x2="22" y2="12" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
          </svg>
        </div>
      )}

      {/* Corner brackets */}
      {hasPermission && (
        <>
          <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-amber-500/40" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-amber-500/40" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-amber-500/40" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-amber-500/40" />
          <div className="absolute top-2 left-2 text-[9px] font-mono text-amber-600 pl-6">LIVE</div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [riskScore, setRiskScore] = useState(0)
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
      <div className="min-h-screen bg-[#07090e] text-slate-200 font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold text-slate-100">Join Interview</h1>
            <p className="text-sm text-slate-500">Paste the room ID from the link your interviewer sent you.</p>
          </div>

          {!roomPreview && (
            <form onSubmit={handleLookupRoom} className="space-y-4">
              <input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Room ID"
                className="w-full bg-[#0f1117] border border-[#1e2230] rounded px-3 py-2 text-sm font-mono tracking-widest text-center"
                autoFocus
              />
              {previewError && <p className="text-sm text-red-500 text-center">{previewError}</p>}
              <button
                type="submit"
                disabled={previewLoading || !roomIdInput.trim()}
                className="w-full bg-amber-500 text-black font-medium rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                {previewLoading ? "Looking up…" : "Find room"}
              </button>
            </form>
          )}

          {roomPreview && roomPreview.join_status !== "requested" && (
            <div className="space-y-4">
              <div className="bg-[#0f1117] border border-[#1e2230] rounded px-3 py-3 text-sm text-center space-y-1">
                <p className="text-slate-100">{roomPreview.candidate_name}</p>
                <p className="text-slate-500">{roomPreview.role}</p>
              </div>
              {previewError && <p className="text-sm text-red-500 text-center">{previewError}</p>}
              {roomPreview.join_status === "rejected" && (
                <p className="text-sm text-amber-500 text-center">Your last request was declined.</p>
              )}
              <button
                type="button"
                onClick={handleAskToJoin}
                disabled={requesting}
                className="w-full bg-amber-500 text-black font-medium rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                {requesting ? "Sending…" : "Ask to Join"}
              </button>
              <button
                type="button"
                onClick={() => setRoomPreview(null)}
                className="w-full text-xs text-center text-slate-600 underline underline-offset-2"
              >
                Look up a different room
              </button>
            </div>
          )}

          {roomPreview && roomPreview.join_status === "requested" && (
            <div className="space-y-2 text-center">
              <div className="bg-[#0f1117] border border-[#1e2230] rounded px-3 py-3 text-sm space-y-1">
                <p className="text-slate-100">{roomPreview.candidate_name}</p>
                <p className="text-slate-500">{roomPreview.role}</p>
              </div>
              <p className="text-sm text-slate-400">Waiting for the interviewer to let you in…</p>
            </div>
          )}

          {userEmail && (
            <p className="text-xs text-center text-slate-600">
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
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-sans p-4 lg:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-[#1e2230]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-amber-500 flex items-center justify-center">
            <span className="text-xs font-bold text-black">P</span>
          </div>
          <div>
            <span className="font-semibold text-slate-100 tracking-tight">UnGhosted</span>
            <span className="ml-2 text-xs font-mono text-slate-600">v2.4.1</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="text-slate-600">SESSION</span>
            <span className="text-amber-500">{SESSION_ID}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${isSessionActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
            <span className={isSessionActive ? "text-emerald-400" : "text-slate-600"}>
              {isSessionActive ? elapsedStr : "IDLE"}
            </span>
          </div>
          <button
            onClick={isSessionActive ? stopSession : startSession}
            className={`text-xs font-mono font-medium px-4 py-1.5 rounded border transition-all ${
              isSessionActive
                ? "border-red-800 text-red-400 hover:bg-red-900/30"
                : "border-amber-700 text-amber-400 hover:bg-amber-900/30"
            }`}
          >
            {isSessionActive ? "END SESSION" : "START SESSION"}
          </button>
        </div>
      </header>

      {/* Candidate Info Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-5 px-4 py-3 rounded-lg bg-[#0f1117] border border-[#1e2230]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1c2030] flex items-center justify-center text-sm font-semibold text-amber-500">
            {CANDIDATE.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">{CANDIDATE}</div>
            <div className="text-xs text-slate-600 font-mono">{ROLE}</div>
          </div>
        </div>
        <div className="h-6 w-px bg-[#1e2230] hidden sm:block" />
        {criticalCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-red-400">{criticalCount} critical alert{criticalCount !== 1 ? "s" : ""}</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-amber-400">{warningCount} warning{warningCount !== 1 ? "s" : ""}</span>
          </div>
        )}
        {!isSessionActive && (
          <div className="text-xs font-mono text-slate-600 ml-auto">Session not started</div>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Left: Webcam + Gaze */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Camera Feed</span>
              {hasCamera && isSessionActive && (
                <span className="text-xs font-mono text-amber-600">Eye tracking active</span>
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
                wsBaseUrl={import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000"}
                roomId={roomSession.roomId}
                token={roomSession.token}
              />
            )}
            <div>
            <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Screen Feed</span>
            {hasScreen && <span className="text-xs font-mono text-amber-600">Recording</span>}
            </div>
            {isSessionActive ? (
              <ScreenCaptureFeed hasPermission={hasScreen} onPermission={handleScreenPermission} />
            ) : (
            <div className="rounded-lg bg-[#080b12] aspect-video border border-[#1e2230] flex items-center justify-center text-xs text-slate-600 font-mono">
            Starts with session
            </div>
            )}
            </div>
          </div>

          {/* Gaze heatmap legend */}
          {hasCamera && isSessionActive && (
            <div className="rounded-lg bg-[#0f1117] border border-[#1e2230] p-3">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Gaze Analysis</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Deviations", value: monitors.gaze.count.toString(), color: "text-amber-400" },
                  { label: "Status", value: monitors.gaze.value, color: monitors.gaze.status === "warning" ? "text-amber-400" : "text-emerald-400" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-600 font-mono">{item.label}</span>
                    <span className={`text-xs font-mono font-medium ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detection method note */}
          <div className="rounded-lg bg-[#0a0c12] border border-[#1a1e2a] p-3">
            <div className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-2">Detection Coverage</div>
            <div className="space-y-1.5">
              {[
                { label: "Ghost overlay tools", note: "Focus/blur + mouse tracking (gaze cannot see on-screen content)" },
                { label: "Phone / 2nd device", note: "Gaze deviation + voice" },
                { label: "Pre-typed answers", note: "Keyboard cadence analysis" },
                { label: "Browser tab switch", note: "Visibility API" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-slate-500">{item.label}</span>
                  <span className="text-[10px] font-mono text-slate-600 text-right">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Risk + Monitors + Log */}
        <div className="flex flex-col gap-5">
          {/* Risk Score + Monitor Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
            {/* Risk gauge */}
            <div className="rounded-lg bg-[#0f1117] border border-[#1e2230] p-5 flex flex-col items-center gap-3">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest self-start">Risk Score</span>
              <RiskGauge score={riskScore} />
              <div className="w-full space-y-1 mt-1">
                {[
                  { label: "0–24", color: "bg-emerald-500", text: "Low" },
                  { label: "25–59", color: "bg-amber-500", text: "Elevated" },
                  { label: "60+", color: "bg-red-500", text: "High Risk" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`w-2 h-1.5 rounded-sm ${item.color}`} />
                    <span className="text-[10px] font-mono text-slate-600">{item.label}</span>
                    <span className="text-[10px] font-mono text-slate-500">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monitor cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MonitorCard icon="🪟" label="Tab Focus" monitor={monitors.tabFocus} />
              <MonitorCard icon="🎙" label="Audio" monitor={monitors.audio} />
              <MonitorCard icon="👁" label="Gaze" monitor={monitors.gaze} />
              <MonitorCard icon="🖱" label="Mouse" monitor={monitors.mouse} />
              <MonitorCard icon="📋" label="Clipboard" monitor={monitors.clipboard} />
              <MonitorCard icon="⌨️" label="Keystrokes" monitor={monitors.keyboard} />
              <MonitorCard icon="🚫" label="Hidden Apps" monitor={monitors.process} />
            </div>
          </div>

          {/* Alert thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Screen-Share Bypass",
                desc: "Overlay tools that exclude themselves from screen capture can't be caught by webcam gaze alone — gaze looks the same whether reading the intended content or an overlay. Focus/blur and mouse-egress events are the actual signal here.",
                icon: "🛡",
                severity: "critical" as const,
              },
              {
                title: "External AI Tools",
                desc: "Clipboard paste events and keyboard burst patterns indicate AI-generated answers being copied in from external sessions.",
                icon: "🤖",
                severity: "warning" as const,
              },
              {
                title: "Phone / Second Screen",
                desc: "Repeated gaze deviation toward off-screen areas combined with voice activity suggests reference to a secondary device.",
                icon: "📱",
                severity: "warning" as const,
              },
            ].map((card) => (
              <div
                key={card.title}
                className={`rounded-lg p-3 border bg-[#0f1117] ${
                  card.severity === "critical" ? "border-red-900/40" : "border-amber-900/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span>{card.icon}</span>
                  <span className="text-xs font-medium text-slate-300">{card.title}</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Event Log */}
          <div className="rounded-lg bg-[#0f1117] border border-[#1e2230] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Event Log</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-600">{events.length} events</span>
                {events.length > 0 && (
                  <button
                    onClick={() => { setEvents([]); setRiskScore(0) }}
                    className="text-xs font-mono text-slate-700 hover:text-slate-500 transition-colors"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
            <EventLog events={events} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 pt-4 border-t border-[#1e2230] flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-700">
          Unghosted • Browser-native behavioral analysis
        </span>
        <span className="text-[10px] font-mono text-slate-700">
          Tab API · Web Audio API · Gaze estimation · Keyboard heuristics
        </span>
      </footer>
    </div>
  )
}

