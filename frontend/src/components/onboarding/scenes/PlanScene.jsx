import { useEffect, useRef } from 'react'
import { reducedMotion } from '../../../lib/reduced-motion.js'
import { cx } from '../../../lib/ui-kit.js'
import StageArt from '../StageArt.jsx'

// 5 Plan: one plan card, three states (the kit's `plan` scene: the dashed card, the solid one, the
// coach's three dots and the accent +). Nothing chosen: the dashed card. A ready-made plan: the
// card solid, one row per training day (four at most), drawn in 60ms apart. The AI coach: a speech
// bubble draws round the card, three dots light once, then the rows. Not now: the rows retract
// and the accent + appears. The rows and the bubble are drawn over the scene in its geometry;
// onboarding.css shows the scene's parts for the state.
const ROW_LEN = [60, 44, 52, 40]
const EASE_IO = 'cubic-bezier(.65,0,.35,1)'
const full = s => s === 'starter' || s === 'coach'
// A state part that draws when its state arrives (a dash of the whole length, offset by script),
// not with the scene.
const STROKE = { pathLength: 1, strokeDasharray: 1 }

function draw(el, delay, duration) {
  if (!el?.animate) return
  el.setAttribute('pathLength', '1')
  el.animate([{ strokeDasharray: '1', strokeDashoffset: 1, opacity: 0 }, { strokeDasharray: '1', strokeDashoffset: 0, opacity: 1 }],
    { duration, delay, easing: EASE_IO, fill: 'backwards' })
}

export default function PlanScene({ state, days }) {
  const root = useRef(null)
  const before = useRef(state)
  const rows = Math.min(4, days || 0)
  // The change from one state to the next is what moves: a scene arriving at a state is still.
  useEffect(() => {
    const prev = before.current
    before.current = state
    const g = root.current
    const svg = g?.ownerSVGElement
    if (!g || !svg || prev === state || reducedMotion()) return
    const at0 = state === 'coach' ? 600 : 0
    if (full(state) && !full(prev)) g.querySelectorAll('.ob-pr-ln').forEach((p, i) => draw(p, at0 + i * 60, 320))
    if (state === 'coach') {
      g.querySelectorAll('.ob-pb > *').forEach(p => draw(p, 0, 480))
      svg.querySelectorAll('.pdot').forEach((d, i) => d.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 480 + i * 120, easing: 'linear', fill: 'backwards' }))
    }
    if (state === 'none') draw(svg.querySelector('.pplus'), 0, 320)
  }, [state])
  return (
    <StageArt name="plan" width={280} className={cx('ob-plan', state && 'is-' + state, full(state) && 'full')}>
      <g ref={root}>
        <g className={cx('ob-pb ob-fadeable', state !== 'coach' && 'ob-off')}>
          <rect className="il-acc" x="88" y="6" width="144" height="110" rx="16" {...STROKE} />
          <path className="il-acc" d="M112 116 l-6 4 l18 -4" {...STROKE} />
        </g>
        {Array.from({ length: rows }, (_, i) => {
          const y = 36 + 18 * i
          return (
            <g key={i} className={cx('ob-pr', !full(state) && 'ob-off')}>
              <path className="il-acc" d={`M114 ${y} h12 M116 ${y - 4} v8 M124 ${y - 4} v8`} />
              <path className="il il-d ob-pr-ln" d={`M136 ${y} h${ROW_LEN[i]}`} {...STROKE} />
            </g>
          )
        })}
      </g>
    </StageArt>
  )
}
