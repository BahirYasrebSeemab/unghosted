/**
 * concentrationMonitor.ts
 * -----------------------
 * Webcam-based "focus / concentration" estimator for the browser.
 *
 * What it does:
 *   - Uses MediaPipe's FaceLandmarker (tasks-vision) to track face + iris landmarks
 *     from the user's own webcam feed, in real time, in-page.
 *   - Derives three signals:
 *       1. Gaze deviation   - how far the iris is from looking straight at the screen
 *       2. Head pose        - yaw/pitch deviation from facing the camera
 *       3. Blink / eye-closure rate - via Eye Aspect Ratio (EAR)
 *   - Combines them into a smoothed 0-100 "concentration score"
 *   - Renders a normal, visible on-page overlay (a plain DOM element you control -
 *     it participates in the page like any other UI, nothing about it is designed
 *     to evade screen capture, recording, or monitoring software).
 *
 * Dependencies (install via npm):
 *   npm install @mediapipe/tasks-vision
 *
 * Model file needed at runtime (download once, serve it yourself or from a CDN):
 *   https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
 *
 * Usage:
 *   const monitor = new ConcentrationMonitor({ videoEl, mountOverlayTo: document.body });
 *   await monitor.start();
 *   monitor.onUpdate((reading) => console.log(reading.score, reading.state));
 *   // later
 *   monitor.stop();
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConcentrationState = "focused" | "distracted" | "away" | "drowsy";

export interface ConcentrationReading {
  /** 0 (fully distracted / absent) to 100 (fully focused) */
  score: number;
  state: ConcentrationState;
  gazeDeviation: number; // 0..1, higher = looking away from camera/screen
  headDeviation: number; // 0..1, higher = head turned/tilted away
  blinkRatePerMin: number;
  faceDetected: boolean;
  timestamp: number;
}

export interface ConcentrationMonitorOptions {
  /** An existing <video> element already wired to the user's webcam stream. */
  videoEl: HTMLVideoElement;
  /** Where to attach the visible on-page overlay. Pass null to skip rendering one. */
  mountOverlayTo?: HTMLElement | null;
  /** Path to the FaceLandmarker .task model file. Defaults to Google's hosted asset. */
  modelAssetPath?: string;
  /** How many recent frames to smooth the score over. Default 30 (~1s at 30fps). */
  smoothingWindow?: number;
  /** Score below which state becomes "distracted". Default 55. */
  distractedThreshold?: number;
  /** Score below which state becomes "away"/"drowsy" is decided by faceDetected/blink. Default 25. */
  awayThreshold?: number;
}

type UpdateCallback = (reading: ConcentrationReading) => void;

// ---------------------------------------------------------------------------
// Landmark index constants (MediaPipe FaceMesh topology, 478 points w/ iris)
// ---------------------------------------------------------------------------

const LEFT_EYE = { top: 386, bottom: 374, left: 362, right: 263 };
const RIGHT_EYE = { top: 159, bottom: 145, left: 33, right: 133 };
const LEFT_IRIS_CENTER = 473;
const RIGHT_IRIS_CENTER = 468;
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
  z?: number;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Eye Aspect Ratio - low value means the eye is closed/closing. */
function eyeAspectRatio(pts: Record<string, Point>, eye: typeof LEFT_EYE, landmarks: Point[]): number {
  const top = landmarks[eye.top];
  const bottom = landmarks[eye.bottom];
  const left = landmarks[eye.left];
  const right = landmarks[eye.right];
  const vertical = dist(top, bottom);
  const horizontal = dist(left, right);
  if (horizontal === 0) return 0;
  return vertical / horizontal;
}

/** How far the iris center sits from the eye's geometric center, normalized by eye width. */
function irisOffset(landmarks: Point[], eye: typeof LEFT_EYE, irisIdx: number): number {
  const left = landmarks[eye.left];
  const right = landmarks[eye.right];
  const iris = landmarks[irisIdx];
  const eyeCenter: Point = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const eyeWidth = dist(left, right) || 1;
  return dist(iris, eyeCenter) / eyeWidth;
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class ConcentrationMonitor {
  private videoEl: HTMLVideoElement;
  private overlayHost: HTMLElement | null;
  private overlayEl: HTMLDivElement | null = null;
  private modelAssetPath: string;
  private smoothingWindow: number;
  private distractedThreshold: number;
  private awayThreshold: number;

  private landmarker: FaceLandmarker | null = null;
  private rafId: number | null = null;
  private running = false;

  private scoreHistory: number[] = [];
  private blinkTimestamps: number[] = [];
  private wasEyeClosed = false;
  private listeners: UpdateCallback[] = [];
  private lastReading: ConcentrationReading | null = null;

  constructor(opts: ConcentrationMonitorOptions) {
    this.videoEl = opts.videoEl;
    this.overlayHost = opts.mountOverlayTo ?? null;
    this.modelAssetPath =
      opts.modelAssetPath ??
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
    this.smoothingWindow = opts.smoothingWindow ?? 30;
    this.distractedThreshold = opts.distractedThreshold ?? 55;
    this.awayThreshold = opts.awayThreshold ?? 25;
  }

  /** Loads the model and begins the detection loop. Requires videoEl to already have a live stream. */
  async start(): Promise<void> {
    if (this.running) return;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: this.modelAssetPath, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    if (this.overlayHost) {
      this.overlayEl = this.buildOverlay();
      this.overlayHost.appendChild(this.overlayEl);
    }

    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.landmarker?.close();
    this.landmarker = null;
    this.overlayEl?.remove();
    this.overlayEl = null;
  }

  onUpdate(cb: UpdateCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  getLastReading(): ConcentrationReading | null {
    return this.lastReading;
  }

  // -- internal ---------------------------------------------------------

  private loop = (): void => {
    if (!this.running || !this.landmarker) return;

    if (this.videoEl.readyState >= 2) {
      const nowMs = performance.now();
      const result = this.landmarker.detectForVideo(this.videoEl, nowMs);
      const reading = this.computeReading(result, nowMs);
      this.lastReading = reading;
      this.renderOverlay(reading);
      this.listeners.forEach((cb) => cb(reading));
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private computeReading(result: FaceLandmarkerResult, nowMs: number): ConcentrationReading {
    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) {
      return this.pushScore(0, { faceDetected: false, gazeDeviation: 1, headDeviation: 1, nowMs });
    }

    const lm = faces[0] as unknown as Point[];

    // --- Gaze: average iris offset across both eyes, normalized 0..1 (roughly) ---
    const leftGaze = irisOffset(lm, LEFT_EYE, LEFT_IRIS_CENTER);
    const rightGaze = irisOffset(lm, RIGHT_EYE, RIGHT_IRIS_CENTER);
    // Values around 0.15-0.25 are "centered"; scale/clamp into a 0..1 deviation.
    const gazeDeviation = clamp01((((leftGaze + rightGaze) / 2) - 0.15) / 0.35);

    // --- Head pose: use nose/chin/forehead/cheek geometry as a cheap proxy ---
    const forehead = lm[FOREHEAD];
    const chin = lm[CHIN];
    const leftCheek = lm[LEFT_CHEEK];
    const rightCheek = lm[RIGHT_CHEEK];
    const nose = lm[NOSE_TIP];

    const faceMidX = (leftCheek.x + rightCheek.x) / 2;
    const faceWidth = dist(leftCheek, rightCheek) || 1;
    const yawDeviation = clamp01(Math.abs(nose.x - faceMidX) / (faceWidth * 0.5));

    const faceMidY = (forehead.y + chin.y) / 2;
    const faceHeight = dist(forehead, chin) || 1;
    const pitchDeviation = clamp01(Math.abs(nose.y - faceMidY) / (faceHeight * 0.6));

    const headDeviation = clamp01((yawDeviation + pitchDeviation) / 2);

    // --- Blink tracking via EAR, for drowsiness / disengagement signal ---
    const leftEAR = eyeAspectRatio({}, LEFT_EYE, lm);
    const rightEAR = eyeAspectRatio({}, RIGHT_EYE, lm);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const eyeClosed = avgEAR < 0.18;

    if (eyeClosed && !this.wasEyeClosed) {
      this.blinkTimestamps.push(nowMs);
    }
    this.wasEyeClosed = eyeClosed;
    // keep only the last 60s of blinks
    this.blinkTimestamps = this.blinkTimestamps.filter((t) => nowMs - t <= 60_000);
    const blinkRatePerMin = this.blinkTimestamps.length;

    // --- Combine into a raw instantaneous score ---
    // Gaze and head deviation each pull the score down; extreme blink rates
    // (very high = strained/tired, very low w/ eyes mostly closed = drowsy) also penalize.
    let raw = 100 * (1 - 0.55 * gazeDeviation - 0.45 * headDeviation);
    if (eyeClosed) raw -= 15; // sustained closed eyes right now
    raw = Math.max(0, Math.min(100, raw));

    return this.pushScore(raw, {
      faceDetected: true,
      gazeDeviation,
      headDeviation,
      blinkRatePerMin,
      eyeClosed,
      nowMs,
    });
  }

  private pushScore(
    raw: number,
    ctx: {
      faceDetected: boolean;
      gazeDeviation: number;
      headDeviation: number;
      blinkRatePerMin?: number;
      eyeClosed?: boolean;
      nowMs: number;
    }
  ): ConcentrationReading {
    this.scoreHistory.push(raw);
    if (this.scoreHistory.length > this.smoothingWindow) this.scoreHistory.shift();
    const smoothed = this.scoreHistory.reduce((a, b) => a + b, 0) / this.scoreHistory.length;

    let state: ConcentrationState;
    if (!ctx.faceDetected) {
      state = "away";
    } else if (ctx.eyeClosed && smoothed < this.awayThreshold) {
      state = "drowsy";
    } else if (smoothed < this.distractedThreshold) {
      state = "distracted";
    } else {
      state = "focused";
    }

    return {
      score: Math.round(smoothed),
      state,
      gazeDeviation: ctx.gazeDeviation,
      headDeviation: ctx.headDeviation,
      blinkRatePerMin: ctx.blinkRatePerMin ?? 0,
      faceDetected: ctx.faceDetected,
      timestamp: ctx.nowMs,
    };
  }

  // -- overlay (a normal, visible DOM element - just page UI) -----------

  private buildOverlay(): HTMLDivElement {
    const el = document.createElement("div");
    el.id = "concentration-overlay";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      padding: "10px 14px",
      borderRadius: "10px",
      background: "rgba(20,20,24,0.85)",
      color: "#fff",
      font: "13px/1.4 system-ui, sans-serif",
      zIndex: "2147483647",
      minWidth: "160px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    el.innerHTML = `<div id="co-state" style="font-weight:600;">Initializing…</div>
      <div id="co-score" style="opacity:.8;"></div>`;
    return el;
  }

  private renderOverlay(reading: ConcentrationReading): void {
    if (!this.overlayEl) return;
    const stateEl = this.overlayEl.querySelector("#co-state") as HTMLDivElement;
    const scoreEl = this.overlayEl.querySelector("#co-score") as HTMLDivElement;
    const labels: Record<ConcentrationState, string> = {
      focused: "🟢 Focused",
      distracted: "🟡 Distracted",
      drowsy: "🟠 Drowsy",
      away: "🔴 Away from screen",
    };
    stateEl.textContent = labels[reading.state];
    scoreEl.textContent = `Score: ${reading.score}/100 · blinks/min: ${reading.blinkRatePerMin}`;
  }
}

// ---------------------------------------------------------------------------
// Convenience: wire up a webcam <video> element for you
// ---------------------------------------------------------------------------

export async function attachWebcam(videoEl: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  videoEl.srcObject = stream;
  videoEl.muted = true;
  await videoEl.play();
  return stream;
}

