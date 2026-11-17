import { useRef } from 'react'
import { reducedMotion } from '../lib/reduced-motion.js'

const SLOP = 8         // px a finger may wander before the press is a swipe, not a tap
const DISTANCE = 40    // px down that lets go of the toast

/**
 * What a toast needs to be put away by hand, as props for its element: a swipe down (the way it
 * came in from), a tap on its body, and Escape while the focus is inside it. A tap on `keep` (its
 * action button) is the action's, not a dismissal. Under reduced motion the toast does not follow
 * the finger; it is only let go of.
 *
 * `onDismiss` may be called more than once for one toast (a swipe's release after the toast's own
 * timer ended it, a tap and a click); whoever owns the toast must make that safe. `enabled` false
 * (the toast is already leaving) turns every handler off.
 */
export function useSwipeDismiss({ ref, onDismiss, enabled = true, keep = 'a, button' }) {
  const drag = useRef(null)
  const swiped = useRef(false)
  const follow = dy => { if (ref.current && !reducedMotion()) ref.current.style.transform = dy > 0 ? `translateY(${dy}px)` : '' }
  const reset = () => { drag.current = null; if (ref.current) ref.current.style.transform = '' }

  if (!enabled) return {}
  return {
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      swiped.current = false
      drag.current = { y: e.clientY, dy: 0 }
    },
    onPointerMove(e) {
      const d = drag.current
      if (!d) return
      d.dy = e.clientY - d.y
      if (Math.abs(d.dy) > SLOP && !swiped.current) {
        swiped.current = true
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
      if (swiped.current) follow(d.dy)
    },
    onPointerUp() {
      const d = drag.current
      if (!d) return
      if (swiped.current && d.dy >= DISTANCE) { drag.current = null; onDismiss() } else reset()
    },
    onPointerCancel: reset,
    onClick(e) {
      // The click that ends a swipe is not a tap.
      if (swiped.current) { swiped.current = false; return }
      if (e.target instanceof Element && e.target.closest(keep) && !e.target.closest('[data-dismiss]')) return
      onDismiss()
    },
    onKeyDown(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onDismiss() }
    },
  }
}
