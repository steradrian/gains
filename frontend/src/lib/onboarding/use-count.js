import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../reduced-motion.js'

const easeOut = p => 1 - Math.pow(1 - p, 3)

/**
 * A number that counts to `target` over `ms` (an ease-out), from wherever it shows now, so a new
 * target mid-count carries on from there. `from`: where the first count starts (the Summary's
 * count-ups start at 0; by default the first value simply shows); `delay`: ms before the first
 * count moves (a later target counts at once).
 * Reduced motion and a non-number jump straight there.
 */
export function useCount(target, ms = 320, { from, delay = 0 } = {}) {
  const [shown, setShown] = useState(from ?? target)
  const now = useRef(from ?? target)
  const counted = useRef(false)
  useEffect(() => {
    const start = now.current
    const jump = !Number.isFinite(target) || !Number.isFinite(start) || start === target
      || reducedMotion() || typeof requestAnimationFrame !== 'function'
    if (jump) {
      now.current = target
      setShown(target)
      return undefined
    }
    let id = 0, t0 = null
    const step = time => {
      if (t0 === null) t0 = time
      const p = Math.min(1, (time - t0) / ms)
      now.current = start + (target - start) * easeOut(p)
      setShown(now.current)
      if (p < 1) id = requestAnimationFrame(step)
    }
    // The delay is the first count's alone: a later target (Adjust) counts at once.
    const wait = delay > 0 && !counted.current ? setTimeout(() => { counted.current = true; id = requestAnimationFrame(step) }, delay) : null
    if (!wait) { counted.current = true; id = requestAnimationFrame(step) }
    return () => { clearTimeout(wait); cancelAnimationFrame(id) }
  }, [target, ms])
  return shown
}
