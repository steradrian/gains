// Liquid glass watchdog (plan 2.7): a device that cannot keep the glass at speed gets the CSS material for
// the rest of the page. It judges the glass's own cost, never the display's rate:
//   - the median main-thread cost of a drawn frame above CPU_MS, or
//   - the median rAF interval above INTERVAL_MS AND well above the device's own cadence (BASE_RATIO times the
//     interval of frames that followed a frame that drew nothing), or above ABS_INTERVAL_MS (under 20 fps).
// A 30 Hz display (Low Power Mode, some iOS states) keeps every interval near 33 ms with or without glass, so
// it never trips on interval alone; a 120 Hz one cannot either.
// Two consecutive one-second windows of active animation must be bad. A window is thrown away when it ends
// inside a grace period: the first SETTLE_MS after the engine starts, and GRACE_MS after every resume, route
// change or presenter rebuild (grace()), when lazy chunks, shader compiles and atlas builds make slow frames.
// The glass is revealed only after the engine has proven itself (proven()): REVEAL_MS since it started and
// no bad window seen, so a device that cannot hold it never shows glass at all. While unproven a bad
// window only delays the reveal; it trips only once PROBE_MAX_MS have passed without proof.
// The glass rarely draws on every frame (look ticks at 15 Hz, sprite refreshes spread over frames), so a frame
// that drew nothing keeps the window going: it adds its interval, and only drawn frames add a CPU cost. Only
// a gap longer than GAP_MS (the loop went idle) starts the window again.

export const OFF_KEY = 'lg-off' // legacy: older builds persisted a trip here; it is removed on load
export const REASON_KEY = 'lg-off-reason'
const WINDOW_MS = 1000
const CPU_MS = 6
const INTERVAL_MS = 24
const BASE_RATIO = 1.5
const ABS_INTERVAL_MS = 50
const MIN_SAMPLES = 12 // frames in a window before its rAF interval counts
const MIN_DRAWN = 10 // drawn frames in a window before its CPU cost counts (a 15 Hz look gives 15)
const MIN_BASE = 10 // frames after an idle frame before they set the baseline
const RING = 240
const GAP_MS = 100
const BAD_WINDOWS = 2
export const SETTLE_MS = 1500
export const GRACE_MS = 3000
export const REVEAL_MS = 2500
export const PROBE_MAX_MS = 8000

const median = list => {
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// A trip lasts for the page, not the session: an installed iOS PWA keeps sessionStorage across launches, and
// a launch must not inherit a verdict from another one.
let pageOff = false
try { sessionStorage.removeItem(OFF_KEY) } catch { /* no storage: nothing stale either */ }

// Why the glass is on the CSS material, for the owner to read when it happens on a device (the dev HUD, or
// sessionStorage `lg-off-reason`): 'watchdog:cpu 7.2ms', 'watchdog:interval 41ms (base 16ms)', 'context-lost:chrome',
// 'mount-failed:chrome', 'reduced-transparency', 'no-stage', 'error'. Cleared when the glass draws again.
export function recordFallback(reason) {
  try { sessionStorage.setItem(REASON_KEY, reason) } catch { /* storage is a convenience */ }
}

export function clearFallback() {
  try { sessionStorage.removeItem(REASON_KEY) } catch { /* see above */ }
}

export function fallbackReason() {
  try { return sessionStorage.getItem(REASON_KEY) || '' } catch { return '' }
}

/** True when a trip earlier in this page load switched the glass off. */
export function glassIsOff() {
  return pageOff
}

/**
 * @param {{ onTrip: () => void }} opts
 * @returns {{ frame(drew: boolean, cpuMs: number, intervalMs: number, nowMs: number): void,
 *   grace(nowMs: number): void, proven(nowMs: number): boolean, provenAtRest(nowMs: number): boolean }}
 * `frame` is called after every scheduler frame: whether it drew, what it cost on the main thread, the time
 * since the previous frame and the current time. `grace` ignores the next GRACE_MS (a resume, a route change,
 * a rebuilt presenter). `proven` is true once the glass may be shown.
 */
export function createWatchdog({ onTrip }) {
  let cpu = []
  let gaps = []
  let started = 0
  let bad = 0
  let last = 0
  let tripped = false
  let why = ''
  let begun = 0 // the first frame's time: the engine's start
  let ignoreUntil = 0
  let prevDrew = true
  let revealed = false
  let good = 0 // consecutive good windows (an idle gap does not clear it)
  const idleGaps = [] // intervals of frames that followed a frame that drew nothing
  const allGaps = []

  const restart = () => { cpu = []; gaps = []; started = 0; bad = 0 }
  const push = (ring, v) => { ring.push(v); if (ring.length > RING) ring.shift() }
  const baseline = () => {
    if (idleGaps.length >= MIN_BASE) return median(idleGaps)
    if (allGaps.length < MIN_SAMPLES) return 0
    return [...allGaps].sort((a, b) => a - b)[Math.floor(allGaps.length * 0.1)]
  }

  function frame(drew, cpuMs, intervalMs, nowMs) {
    if (tripped) return
    if (!begun) { begun = nowMs; ignoreUntil = nowMs + SETTLE_MS }
    const gap = nowMs - last
    if (gap > GAP_MS) restart()
    last = nowMs
    if (intervalMs > 0 && intervalMs < GAP_MS) {
      push(allGaps, intervalMs)
      if (!prevDrew) push(idleGaps, intervalMs)
    }
    prevDrew = drew
    if (nowMs < ignoreUntil) { restart(); return }
    if (!started) started = nowMs
    if (drew) cpu.push(cpuMs)
    gaps.push(intervalMs)
    if (nowMs - started < WINDOW_MS) return
    const cpuMed = cpu.length >= MIN_DRAWN ? median(cpu) : 0
    const gapMed = gaps.length >= MIN_SAMPLES ? median(gaps) : 0
    const base = baseline()
    const slowGap = gapMed > INTERVAL_MS && (gapMed > base * BASE_RATIO || gapMed > ABS_INTERVAL_MS)
    const slow = cpuMed > CPU_MS || slowGap
    if (slow) {
      why = cpuMed > CPU_MS ? `watchdog:cpu ${cpuMed.toFixed(1)}ms` : `watchdog:interval ${gapMed.toFixed(1)}ms (base ${base.toFixed(1)}ms)`
    }
    cpu = []
    gaps = []
    started = nowMs
    bad = slow ? bad + 1 : 0
    good = slow ? 0 : good + 1
    const probing = !revealed && nowMs - begun < PROBE_MAX_MS
    if (bad >= BAD_WINDOWS && !probing) {
      tripped = true
      pageOff = true
      recordFallback(why)
      onTrip()
    }
  }

  return {
    frame,
    grace(nowMs) { ignoreUntil = Math.max(ignoreUntil, nowMs + GRACE_MS); restart() },
    // Proof is a whole window judged good after the settle (and none bad since).
    proven(nowMs) {
      if (tripped) return false
      if (revealed) return true
      if (!begun || nowMs - begun < REVEAL_MS || bad > 0 || good < 1) return false
      revealed = true
      return true
    },
    // The engine's reveal timer, asked while the loop is idle: nothing is running, so nothing is slow, and a
    // page at rest has no window to judge. Never proves a loop that is still animating.
    provenAtRest(nowMs) {
      if (tripped) return false
      if (revealed) return true
      if (!begun || nowMs - begun < REVEAL_MS || bad > 0 || nowMs - last <= GAP_MS) return false
      revealed = true
      return true
    },
  }
}
