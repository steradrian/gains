import { useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { onReducedMotion, reducedMotion } from '../reduced-motion.js'
import { ThreadContext } from './contexts.js'
import { LAND_MS } from './thread-engine.js'

// The Summary's timeline (fitness-eval motion-onboarding-summary-v2 §2; t from the start of the
// push, which is where the screen comes in over 0-320 while the thread glides to the line where
// the ring will be). The thread lands on that line; the line then retracts into the ring's 9
// o'clock point while the ring draws clockwise out of it (the dash-swap), the number counts up
// inside it, and the rest is built around it in reading order. WAAPI on transform, opacity and the
// ring's own stroke; nothing that moves layout. The call to action is live throughout:
// finishRuns() jumps everything to its end.
//
// The layout brings a screen in after a 60ms delay (thread-engine.js LAND_MS), so every beat here
// is that much later than the spec's t, or the line would start to retract under the layer that
// still covers it.
//
// Under reduced motion nothing here runs: the screen fades in as every onboarding screen does
// (OnboardingLayout, 120ms linear) with every number final.

const EASE_IO = 'cubic-bezier(.65,0,.35,1)'
const OUT = 'cubic-bezier(0,0,.58,1)'
const RING = 168
const C = 2 * Math.PI * 80
// The ghost arc: 270 degrees of the same circle.
export const GHOST = 0.75 * C
export const RING_C = C
const PUSH_MS = 320
/** From mount to the spec's t=0, the start of the push. */
const T0 = LAND_MS - PUSH_MS
/** When the count-up of the kcal and of the water starts, and how long it runs (ms from mount). */
export const COUNT = { kcal: [560 + T0, 600], water: [1040 + T0, 320] }
const SAID_AT = 1000 + T0
// The status line is filled after it is mounted, so the screen reader has a live region to hear it in.
const SAID_AFTER = 150

/**
 * root: the Summary's screen. kind: 'ring' (a target) | 'ghost' (no body data). `zeroDays`: no
 * training days, so nothing is planned and the caption comes in a beat sooner. Returns
 * { playing, said, finishRuns, unwind }: `playing` while the count-ups should count; `said` once
 * the target is complete (the status line is spoken then, once); unwind() is stage A of the
 * hand-over and resolves when it is done.
 */
export function useSummaryMotion(root, kind, { zeroDays = false } = {}) {
  const thread = useContext(ThreadContext)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [said, setSaid] = useState(false)

  useLayoutEffect(() => {
    const el = root.current
    if (!el?.animate || reducedMotion()) {
      setPlaying(false)
      const id = setTimeout(() => setSaid(true), SAID_AFTER)
      return () => clearTimeout(id)
    }
    const q = s => el.querySelector(s)
    const all = []
    const run = (target, frames, opts) => {
      if (target?.animate) all.push(target.animate(frames, { fill: 'backwards', ...opts, delay: opts.delay + T0 }))
    }
    const fade = (target, at, duration = 200, easing = 'linear', rise = 0) =>
      run(target, [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], { duration, delay: at, easing })

    const line = q('.ob-sum-line')
    const width = line?.getBoundingClientRect().width || RING
    const toRing = Math.min(1, RING / width)
    // The line retracts toward 9 o'clock (its left end stays), then into the point itself.
    // At rest the line is not drawn (onboarding.css): it shows only while the thread becomes the ring.
    run(line, [
      { opacity: 1, transform: 'scaleX(1)', easing: EASE_IO },
      { opacity: 1, transform: `scaleX(${toRing})`, offset: 160 / 660, easing: EASE_IO },
      { opacity: 1, transform: 'scaleX(0)' },
    ], { duration: 660, delay: 340 })
    if (kind === 'ring') {
      run(q('.ob-sum-fg'), [{ strokeDashoffset: C, strokeWidth: '2.5px', stroke: 'var(--sep)' }, { strokeDashoffset: 0, strokeWidth: '8px', stroke: 'var(--acc-graphic)' }],
        { duration: 560, delay: 440, easing: EASE_IO })
      fade(q('.ob-sum-track'), 500, 240)
      fade(q('.hero-ring .hero-v'), 540, 160)
      fade(q('.hero-target > .hero-u'), 1000, 200, OUT)
      fade(q('.hero-target .hero-m'), 1040, 240, OUT, 8)
      fade(q('.hero-target .hero-macros'), 1100, 240, OUT, 8)
      fade(q('.hero-target .hero-g'), 1240, 200)
      fade(q('.hero-target .hero-e'), 1240, 200)
      for (const x of el.querySelectorAll('.ob-sum-tail')) fade(x, zeroDays ? 1300 : 1400, 200)
    } else {
      // No target: the line curls into the open arc and stops there (the number is missing).
      run(q('.ob-sum-ghost'), [{ strokeDashoffset: GHOST }, { strokeDashoffset: 0 }], { duration: 420, delay: 420, easing: EASE_IO })
      fade(q('.ob-sum-track'), 480, 240)
      for (const x of el.querySelectorAll('.ob-sum-tail')) fade(x, 820, 220, OUT)
      fade(q('.hero-target .hero-m'), 1040, 240, OUT, 8)
      fade(q('.hero-target .hero-g'), 1100, 200)
      fade(q('.hero-target .hero-e'), 1100, 200)
    }
    const said = setTimeout(() => setSaid(true), kind === 'ring' ? SAID_AT : SAID_AFTER)
    return () => { clearTimeout(said); all.forEach(a => a.cancel()) }
  }, [root, kind, zeroDays])

  /** Everything still moving jumps to its end: the thread's flight, the beats, the count-ups. */
  const finishRuns = useCallback(() => {
    thread?.finish()
    for (const a of root.current?.getAnimations?.({ subtree: true }) || []) { try { a.finish() } catch { /* an endless one */ } }
    setPlaying(false)
    setSaid(true)
  }, [root, thread])

  // Reduced motion switched on mid-flight (the device's setting or the app's): at its end at once.
  useEffect(() => onReducedMotion(finishRuns), [finishRuns])

  /**
   * Stage A: the ring retracts into 9 o'clock while the line Home will take grows out of it
   * (240ms): the hairline, 1×64, where Home's hero has its split; a horizontal one where it has
   * none (the thread element says which, SummaryScreen).
   */
  const unwind = useCallback(() => {
    const el = root.current
    if (!el?.animate) return Promise.resolve()
    const q = s => el.querySelector(s)
    const out = []
    const run = (target, frames, opts) => { if (target?.animate) out.push(target.animate(frames, { fill: 'forwards', easing: EASE_IO, ...opts })) }
    const end = q('.ob-sum-thread')
    if (kind === 'ring') run(q('.ob-sum-fg'), [{ strokeDashoffset: 0 }, { strokeDashoffset: C }], { duration: 240 })
    else run(q('.ob-sum-ghost'), [{ strokeDashoffset: 0 }, { strokeDashoffset: GHOST }], { duration: 240 })
    if (end?.classList.contains('flat')) {
      run(end, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 240 })
    } else {
      // It comes out of the ring's edge as thick as the ring's stroke (8) and thins to the hairline.
      const hair = end ? parseFloat(getComputedStyle(end).width) || 1 : 1
      run(end, [{ transform: `scale(${8 / hair}, 0)`, backgroundColor: 'var(--acc-graphic)' }, { transform: 'scale(1, 1)', backgroundColor: 'var(--sep)' }], { duration: 240 })
    }
    run(q('.ob-sum-track'), [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear' })
    run(q('.hero-target > .hero-u'), [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear' })
    return Promise.all(out.map(a => a.finished)).then(() => {}, () => {})
  }, [root, kind])

  return { playing, said, finishRuns, unwind }
}
