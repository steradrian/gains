// The running workout's "Done set" moment, transform only. When a set is ticked the done card gains
// a row and everything under it moves down by that row: `useSlide` turns that jump into a slide
// (FLIP from where the element was drawn to where it now sits) and `useEmerge` lets the new row
// come out of the white Done pill. Both read the position the element is *drawn* at, so a second
// tap in the middle of a slide starts from where it is rather than snapping. Reduced motion: nothing
// is animated, the state just changes.
import { useLayoutEffect, useRef } from 'react'
import { animate, motionValue } from 'motion/react'
import { reducedMotion } from './reduced-motion.js'
import { springSmooth } from './motion.js'

const paint = (el, y) => { el.style.transform = y ? `translate3d(0, ${y}px, 0)` : '' }

function drive(el, y, from) {
  y.stop()
  y.set(from)
  paint(el, from)
  return animate(y, 0, { ...springSmooth, onUpdate: v => paint(el, v), onComplete: () => paint(el, 0) })
}

/** Slides `ref`'s element from its old position to its new one whenever a render moves it. */
export function useSlide(ref) {
  const y = useRef(null)
  const layoutTop = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!y.current) y.current = motionValue(0)
    const cur = y.current.get()
    const top = el.getBoundingClientRect().top - cur + window.scrollY
    const was = layoutTop.current
    layoutTop.current = top
    if (was == null) return
    if (reducedMotion()) { y.current.stop(); y.current.set(0); paint(el, 0); return }
    const delta = was + cur - top
    if (Math.abs(delta) < 1) return
    drive(el, y.current, delta)
  })
  useLayoutEffect(() => () => y.current?.stop(), [])
}

/** Brings `el` in from `fromY` (viewport y of the pill's centre), fading it up. */
export function emerge(el, fromY) {
  if (!el || reducedMotion()) return
  const r = el.getBoundingClientRect()
  const dy = fromY - (r.top + r.height / 2)
  const y = motionValue(dy)
  el.style.opacity = '0'
  paint(el, dy)
  const o = motionValue(0)
  animate(o, 1, { duration: 0.2, ease: [0, 0, 0.2, 1], onUpdate: v => { el.style.opacity = String(v) }, onComplete: () => { el.style.opacity = '' } })
  animate(y, 0, { ...springSmooth, onUpdate: v => paint(el, v), onComplete: () => paint(el, 0) })
}
