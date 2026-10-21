// The header's one motion (fitness-eval ui-search.md §10.4), copied from bearmenu: the search
// field's magnifier (MotionSearch). The header itself never moves while searching (owner
// direction, PR-07): only the bell's glyph turns into × (ds.css) and this lens sweeps. It loads
// with the search chunk, so the `motion` engine never weighs on the first paint: until then the
// field shows the same glyph standing still (ds/StageHeader.jsx).
import { useCallback, useEffect, useRef } from 'react'
import { LazyMotion, domAnimation, m, useAnimationControls } from 'motion/react'
import { GESTURE_MS, HOLD_GRACE_MS, beats, returnTransition } from '../../lib/motion.js'
import { useReducedMotionPref } from './use-reduced-motion.js'

// The parts' pivots (the lens at its handle's end, 21,21; the dot at its centre, 11,11) are
// search.css's .mm-lens and .mm-dot, in the 24-unit viewBox (`transform-box: view-box`).
const ROOT = {
  rest: { strokeWidth: 1.75, transition: { duration: 0.18 } },
  active: { strokeWidth: 2.25, transition: { duration: 0.18 } },
  play: { strokeWidth: 2.25, transition: { duration: 0.12 } },
}
const TIMES = [0, 0.16, 0.48, 0.78, 1]
const LENS = {
  rest: { rotate: 0, transition: returnTransition },
  active: { rotate: 0, transition: returnTransition },
  play: { rotate: [0, 9, -16, 4, 0], transition: beats(TIMES, 0.6) },
}
const FOUND = {
  rest: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
  active: { scale: 1, opacity: 1, transition: { duration: 0.15 } },
  play: { scale: [0, 0, 0, 1.3, 1], opacity: [0, 0, 0, 1, 1], transition: beats(TIMES, 0.6) },
}

// bearmenu's useIconGesture: mount posed without playing; pointer down plays; arriving at the
// active pose plays unless the pointer already did; leaving returns. Reduced motion skips the
// gesture and sets the pose, so the dot and the stroke still change.
function useIconGesture(active, replayToken, reduced) {
  const controls = useAnimationControls()
  const lastPlayAt = useRef(0)
  const seenToken = useRef(replayToken)
  const seenActive = useRef(null)
  const plays = useRef(0)
  const mounted = useRef(false)
  const restTimer = useRef(null)
  const clearRest = useCallback(() => { clearTimeout(restTimer.current); restTimer.current = null }, [])

  useEffect(() => {
    mounted.current = true
    controls.set(active ? 'active' : 'rest')
    seenActive.current = active
    return () => { mounted.current = false; clearRest() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const perform = useCallback(async () => {
    const id = ++plays.current
    lastPlayAt.current = Date.now()
    clearRest()
    if (reduced) { if (seenActive.current) controls.set('active'); return }
    await controls.start('play')
    if (!mounted.current || plays.current !== id) return
    if (seenActive.current) { controls.set('active'); return }
    restTimer.current = setTimeout(() => { restTimer.current = null; if (mounted.current && !seenActive.current) controls.set('rest') }, HOLD_GRACE_MS)
  }, [controls, clearRest, reduced])

  useEffect(() => {
    if (replayToken === seenToken.current) return
    seenToken.current = replayToken
    perform()
  }, [replayToken, perform])

  useEffect(() => {
    if (seenActive.current === null || seenActive.current === active) return
    seenActive.current = active
    if (reduced) { clearRest(); controls.set(active ? 'active' : 'rest'); return }
    const since = Date.now() - lastPlayAt.current
    if (!active) {
      if (since < GESTURE_MS) return
      clearRest()
      controls.start('rest')
      return
    }
    if (since < GESTURE_MS + HOLD_GRACE_MS) { clearRest(); if (since >= GESTURE_MS) controls.set('active'); return }
    perform()
  }, [active, controls, perform, clearRest, reduced])

  return controls
}

/** The field's magnifier: sweeps on the press that opens search, holds a found dot while it is open. */
export function MotionMagnifier({ active = false, replayToken = 0, className }) {
  const reduced = useReducedMotionPref()
  const controls = useIconGesture(active, replayToken, reduced)
  return <LazyMotion features={domAnimation}>
    <m.svg viewBox="0 0 24 24" overflow="visible" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
      variants={ROOT} initial={false} animate={controls} className={'icn ' + (className || '')} data-icon="magnifier" aria-hidden="true" focusable="false">
      <m.g variants={LENS} className="mm-lens">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.34-4.34" />
        <m.circle variants={FOUND} opacity={0} className="mm-dot" fill="currentColor" cx="11" cy="11" r="2.5" />
      </m.g>
    </m.svg>
  </LazyMotion>
}
