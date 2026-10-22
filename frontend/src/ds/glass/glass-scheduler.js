import { cancelFrame, currentPhase, requestFrame, REST_PHASE, subscribePhase } from '../../lib/stage-look/clock.js'
import { SELECTOR } from './glass-registry.js'

// Liquid glass scheduler: nothing runs at rest. A wake trigger starts a loop on the shared frame clock
// (clock.js: the look's rAF and the glass's are one); `frame(dt)` says whether anything changed, and the
// loop stops after two frames that changed nothing (and once any transition or animation that was
// announced has had time to finish).

const IDLE_FRAMES = 2
const MAX_DT = 0.05
export const LOOK_HZ = 15
export const LOOK_MS = 1000 / LOOK_HZ
// The gate's clock is the frame that took the last phase, about one frame after its publish, so it allows a
// frame and a little more early. StageLook publishes at most every 33 ms, so this still takes every other
// publish: 15 Hz, never more.
const LOOK_SLACK_MS = 20
const TRANSITION_HOLD_MS = 500

/**
 * The look as the glass sees it (plan 2.7: look-driven glass at most 15 Hz). StageLook publishes its phase
 * about 30 times a second; the glass takes a new phase at most every LOOK_MS and holds it in between, so
 * the chrome strip and the sprites redraw for the look at 15 Hz and the loop can go idle between ticks.
 * `due()`: a new phase would be taken now. `phase(animating)`: the phase to draw this frame (the resting
 * phase when the look stands still).
 */
export function createLookGate({ now = () => performance.now() } = {}) {
  let at = -Infinity
  let phase = REST_PHASE
  const due = () => now() - at >= LOOK_MS - LOOK_SLACK_MS
  return {
    due,
    phase(animating) {
      if (!animating) { at = -Infinity; phase = REST_PHASE } else if (due()) { at = now(); phase = currentPhase() }
      return phase
    },
  }
}

/** A gel-like spring per pressed shape: a little overshoot on the swell, none to speak of on release. */
export function createSprings({ reduced = () => false } = {}) {
  /** @type {Map<Element, { v: number, vel: number, target: number, touch: number[] | null, written: string }>} */
  const map = new Map()
  const of = el => {
    let p = map.get(el)
    if (!p) { p = { v: 0, vel: 0, target: 0, touch: null, written: '' }; map.set(el, p) }
    return p
  }
  return {
    press(el, touch) { Object.assign(of(el), { target: 1, touch }) },
    /** Moves the highlight of every held shape; true when one is held. */
    move(touch) {
      let held = false
      for (const p of map.values()) if (p.target === 1) { p.touch = touch; held = true }
      return held
    },
    release() { for (const p of map.values()) p.target = 0 },
    /** { v, touch } for a shape; v is 0 for one that was never pressed. */
    get(el) {
      const p = map.get(el)
      return p ? { v: p.v, touch: p.v > 0.001 ? p.touch : null } : { v: 0, touch: null }
    },
    /** Steps every spring by dt seconds; true while any is still moving. Reduce motion snaps. */
    step(dt) {
      const snap = reduced()
      let moving = false
      for (const [el, p] of map) {
        if (snap) { p.v = p.target; p.vel = 0 } else {
          const acc = 520 * (p.target - p.v) - 24 * p.vel
          p.vel += acc * dt
          p.v += p.vel * dt
          if (Math.abs(p.target - p.v) < 0.001 && Math.abs(p.vel) < 0.01) { p.v = p.target; p.vel = 0 }
        }
        if (p.v !== p.target || p.vel !== 0) moving = true
        else if (p.target === 0 && !el.isConnected) map.delete(el)
      }
      return moving
    },
    /** Writes --lg-press. Call after every read of the frame: a write forces a style recalc. */
    flush() {
      for (const [el, p] of map) {
        const s = p.v.toFixed(3)
        if (p.written !== s) { el.style.setProperty('--lg-press', s); p.written = s }
      }
    },
    clear() {
      for (const el of map.keys()) el.style.removeProperty('--lg-press')
      map.clear()
    },
  }
}

/**
 * @param {{ frame: (dt: number) => boolean, root?: Element, pressable?: (el: Element) => boolean,
 *   reduced?: () => boolean, raf?: (cb: (ts: number) => void) => number, caf?: (id: number) => void,
 *   now?: () => number }} opts
 * `frame` draws and returns whether anything changed. `root` is where shapes live: the pointer
 * handlers press the glass under a finger there. `pressable` filters which shapes spring.
 * `raf`/`caf` default to the shared frame clock. `look` (returned) is the look gate the frame draws with.
 */
export function createScheduler({
  frame, root = null, pressable = () => true, reduced = () => false,
  raf = requestFrame, caf = cancelFrame, now = () => performance.now(),
}) {
  const springs = createSprings({ reduced })
  const look = createLookGate({ now })
  let id = 0
  let idle = 0
  let last = 0
  let holdUntil = 0
  let paused = false
  let disposed = false

  const tick = ts => {
    id = 0
    const dt = Math.min(MAX_DT, Math.max(0.001, (ts - last) / 1000))
    last = ts
    idle = frame(dt) ? 0 : idle + 1
    if (!paused && !disposed && (idle < IDLE_FRAMES || now() < holdUntil)) id = raf(tick)
  }

  /** Starts the loop if it is idle. `holdMs`: keep it going at least that long (a transition began). */
  function wake(_reason, holdMs = 0) {
    if (disposed) return
    if (holdMs > 0) holdUntil = Math.max(holdUntil, now() + holdMs)
    idle = 0
    if (paused || id) return
    last = now()
    id = raf(tick)
  }

  /** M2's stop conditions (a sheet is open, the search overlay, a hidden document). */
  function setPaused(flag) {
    paused = flag
    if (flag) { if (id) caf(id); id = 0 } else wake('resume')
  }

  const cleanups = []
  const on = (target, type, fn, opts) => {
    if (!target) return
    target.addEventListener(type, fn, opts)
    cleanups.push(() => target.removeEventListener(type, fn, opts))
  }
  const doc = typeof document === 'undefined' ? null : document
  const win = typeof window === 'undefined' ? null : window
  const hold = e => wake(e.type, TRANSITION_HOLD_MS)

  on(doc, 'scroll', () => wake('scroll'), { capture: true, passive: true })
  on(win, 'resize', () => wake('resize'))
  on(win?.visualViewport, 'resize', () => wake('viewport'))
  on(win?.visualViewport, 'scroll', () => wake('viewport'))
  for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel']) {
    on(doc, type, hold, true)
  }
  on(doc, 'visibilitychange', () => { if (!doc.hidden) wake('visible') })

  const shapeOf = e => {
    const el = e.target?.closest?.(SELECTOR)
    return el && root?.contains(el) && pressable(el) ? el : null
  }
  on(doc, 'pointerdown', e => {
    const el = shapeOf(e)
    if (!el) return
    const touch = [e.clientX, e.clientY]
    springs.press(el, touch)
    // Pressing the bar lifts its lens.
    const lens = el.dataset.glass === 'bar' ? el.querySelector('[data-glass="lens"]') : null
    if (lens) springs.press(lens, touch)
    wake('pointer')
  }, true)
  on(doc, 'pointermove', e => { if (springs.move([e.clientX, e.clientY])) wake('pointer') }, true)
  const up = () => { springs.release(); wake('pointer') }
  on(win, 'pointerup', up, true)
  on(win, 'pointercancel', up, true)

  // The look publishes about 30 times a second; only a tick the gate would take wakes the loop (no timer).
  cleanups.push(subscribePhase(() => { if (look.due()) wake('look') }))

  function dispose() {
    disposed = true
    if (id) caf(id)
    id = 0
    cleanups.forEach(fn => fn())
    springs.clear()
  }

  return { wake, setPaused, springs, look, dispose }
}
