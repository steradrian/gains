// Liquid glass watchdog (plan 2.7): a device that cannot keep the glass at speed gets the CSS material
// for the rest of the session. It trips when, over two consecutive one-second windows of active glass
// animation, the median CPU cost of a drawn frame is above 6 ms or the median rAF interval above 24 ms.
// The glass rarely draws on every frame (look ticks at 15 Hz, sprite refreshes spread over frames), so a
// frame that drew nothing keeps the window going: it adds its interval, and only drawn frames add a CPU
// cost. Only a gap longer than GAP_MS (the loop went idle) starts the window again.

export const OFF_KEY = 'lg-off'
const WINDOW_MS = 1000
const CPU_MS = 6
const INTERVAL_MS = 24
const MIN_SAMPLES = 20 // frames in a window before its rAF interval counts
const MIN_DRAWN = 10 // drawn frames in a window before its CPU cost counts (a 15 Hz look gives 15)
const GAP_MS = 100
const BAD_WINDOWS = 2

const median = list => {
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** True when an earlier trip in this session switched the glass off. Storage can throw (private mode). */
export function glassIsOff() {
  try { return sessionStorage.getItem(OFF_KEY) === '1' } catch { return false }
}

function remember() {
  try { sessionStorage.setItem(OFF_KEY, '1') } catch { /* the trip still holds for this page load */ }
}

/**
 * @param {{ onTrip: () => void }} opts
 * @returns {{ frame(drew: boolean, cpuMs: number, intervalMs: number, nowMs: number): void }}
 * `frame` is called after every scheduler frame: whether it drew, what it cost on the main thread, the time
 * since the previous frame and the current time.
 */
export function createWatchdog({ onTrip }) {
  let cpu = []
  let gaps = []
  let started = 0
  let bad = 0
  let last = 0
  let tripped = false

  const restart = () => { cpu = []; gaps = []; started = 0; bad = 0 }

  function frame(drew, cpuMs, intervalMs, nowMs) {
    if (tripped) return
    if (nowMs - last > GAP_MS) restart()
    last = nowMs
    if (!started) started = nowMs
    if (drew) cpu.push(cpuMs)
    gaps.push(intervalMs)
    if (nowMs - started < WINDOW_MS) return
    const slow = (cpu.length >= MIN_DRAWN && median(cpu) > CPU_MS) || (gaps.length >= MIN_SAMPLES && median(gaps) > INTERVAL_MS)
    cpu = []
    gaps = []
    started = nowMs
    bad = slow ? bad + 1 : 0
    if (bad >= BAD_WINDOWS) {
      tripped = true
      remember()
      onTrip()
    }
  }

  return { frame }
}
