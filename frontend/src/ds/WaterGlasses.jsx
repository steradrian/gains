import { useId, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { reducedMotion } from '../lib/reduced-motion.js'
import Act from './Act.jsx'

// Water as glasses that fill (bundle.js `WaterGlasses`): one per `step` litres up to `target`,
// and a white + that adds one. Controlled when it has both `value` and `onAdd(litres)` (the new
// total); otherwise it keeps its own count, up to the target. Pick a step that keeps the row to
// twelve glasses or fewer: raise the step, not the count. `label` (the group) and `addLabel` (the
// +) are what a screen reader hears; a caller that knows the person's units passes them, since
// the defaults speak litres and ml.
// Each glass is an SVG tumbler; its water is clipped to the interior and sits at translateY(0)
// when filled, below the base when empty. Only the glasses whose filled state just changed get
// `fill` (rise, settle, bubbles) or `drain` (quick drop); mount and re-renders animate nothing.
// Under reduced motion neither class is set, and the CSS makes the change instant.
const OUTLINE = 'M3 3 H21 L19.3 33 Q19.2 34.2 18 34.2 H6 Q4.8 34.2 4.7 33 Z'
const INTERIOR = 'M4.1 4 H19.9 L18.4 30.6 H5.6 Z'
const WAVE = 'M0 8 Q3 6 6 8 T12 8 T18 8 T24 8 V40 H0 Z'

function Glass({ id, state }) {
  const clip = `g-wg-clip-${id}`
  return (
    <i className={state}>
      <svg viewBox="0 0 24 36" preserveAspectRatio="xMidYMax meet" focusable="false">
        <defs><clipPath id={clip}><path d={INTERIOR} /></clipPath></defs>
        <path className="g-wg-inner" d={INTERIOR} />
        <g clipPath={`url(#${clip})`}>
          <g className="g-wg-water">
            <path className="g-wg-surf" d={WAVE} />
            <circle className="g-wg-bub g-wg-b1" cx="9" cy="26" r="1" />
            <circle className="g-wg-bub g-wg-b2" cx="15" cy="27" r=".8" />
          </g>
        </g>
        <path className="g-wg-line" d={OUTLINE} />
        <path className="g-wg-shine" d="M6.6 7 L7.6 27" />
      </svg>
    </i>
  )
}

export default function WaterGlasses({ value, target = 2.5, step = 0.25, onAdd, href, label, addLabel }) {
  const uid = useId().replace(/:/g, '')
  const [own, setOwn] = useState(value ?? 0)
  const litres = onAdd && value != null ? value : own
  const glasses = Math.max(1, Math.round(target / step))
  const filled = Math.min(glasses, Math.round(litres / step))
  // The previous filled count; a change records which glasses moved and which way.
  const [last, setLast] = useState({ filled, from: filled, to: filled })
  if (last.filled !== filled) setLast({ filled, from: Math.min(last.filled, filled), to: Math.max(last.filled, filled) })
  const still = reducedMotion()
  const moving = (k) => (!still && k >= last.from && k < last.to ? (filled > last.from ? 'fill' : 'drain') : '')
  const add = () => {
    const next = +(litres + step).toFixed(3)
    setOwn(Math.min(target, next))
    onAdd?.(next)
  }
  return (
    <div className="g-water g-glass" role="group" aria-label={label || t('Water, {0} of {1} L', litres, target)}>
      <div className="g-water-g" aria-hidden="true">
        {Array.from({ length: glasses }, (_, k) => (
          <Glass key={k} id={`${uid}-${k}`} state={[k < filled ? 'on' : '', moving(k)].filter(Boolean).join(' ') || undefined} />
        ))}
      </div>
      <Act href={href} onClick={add} ariaLabel={addLabel || t('Add {0} ml of water', Math.round(step * 1000))} className="g-water-add">
        <Icon name="plus" className="g-icon" />
      </Act>
    </div>
  )
}
