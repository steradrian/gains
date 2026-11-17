import { useLayoutEffect, useRef, useState } from 'react'
import { useThreadAnchor } from '../../lib/onboarding/use-thread-anchor.js'

// 5a: the line the seven day tiles stand on (UI decision 2), 8 below them, spanning the row
// exactly: its viewBox is the measured width, so the round caps end flush. The screen's anchor.
// The Summary's line where the ring will be is the same line in its own place (`className`).
const viewBoxOf = w => `0 0 ${w} 2`
const pathOf = w => `M0.75 1 H${w - 0.75}`

export default function StarterBaseline({ className = 'ob-pl-base' }) {
  const svg = useRef(null)
  const line = useRef(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    const el = svg.current
    if (!el) return undefined
    const fit = () => {
      const width = Math.round(el.getBoundingClientRect().width * 100) / 100
      if (width <= 2) return
      // Written at once as well: the thread measures this line in the next layout effect, before
      // React has rendered the new width. A viewBox still at the old width stretches the stroke
      // (preserveAspectRatio none), the thread lands on that, finds the line thinner once it has
      // rendered, and glides a second time, past the moment the Summary's line turns into the ring.
      el.setAttribute('viewBox', viewBoxOf(width))
      line.current?.setAttribute('d', pathOf(width))
      setW(width)
    }
    fit()
    if (typeof ResizeObserver !== 'function') return undefined
    const ro = new ResizeObserver(fit)
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [])
  useThreadAnchor(line, 'line')
  return (
    <svg ref={svg} className={className} viewBox={viewBoxOf(w)} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path ref={line} d={pathOf(w)} />
    </svg>
  )
}
