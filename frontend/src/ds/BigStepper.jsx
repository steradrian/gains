import { useId, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

const TONES = ['light', 'stage']
const decimalsOf = step => (String(step).split('.')[1] || '').length

// A count with a big − and + either side (bundle.js `BigStepper`: plates in pairs, dumbbell sizes,
// anything counted a step at a time). `value` and `onChange(v)` make it controlled, otherwise it
// keeps its own. `step` moves it, `min` (0 unless given) and `max` stop it, `decimals` is how many
// places the value shows (the step's, unless given). `unit` follows the number, `hint` sits under
// the row, `tone` is `light` (a drawer) or `stage`.
// Every word is the caller's: `label` names the group and is its visible heading, and `lessLabel` and
// `moreLabel` are what the two buttons say aloud ("Fewer 25 kg plates", "More 25 kg plates"),
// worded for what is counted. The value is a polite live region, so a change is spoken. At an
// end the button stays in the tab order and is marked disabled, so focus does not fall off it.
export default function BigStepper({ label, value, step = 1, decimals, min = 0, max, unit, hint, tone = 'light', lessLabel, moreLabel, onChange }) {
  oneOf('BigStepper', 'tone', tone, TONES)
  const id = useId()
  const [own, setOwn] = useState(value !== undefined ? value : min)
  const current = +(value !== undefined ? value : own)
  const places = decimals ?? decimalsOf(step)
  const set = v => {
    const clamped = Math.min(max ?? Infinity, Math.max(min, v))
    const next = +clamped.toFixed(places)
    if (next === current) return
    setOwn(next)
    onChange?.(next)
  }
  const atMin = current <= min
  const atMax = max != null && current >= max
  const glass = tone === 'stage' ? 'g-glass' : undefined
  return (
    <div className={cx('g-bstep', tone === 'stage' && 'g-bstep-stage')} role="group" aria-labelledby={label ? id : undefined}>
      {label && <span id={id} className="g-bstep-l">{label}</span>}
      <div className="g-bstep-row">
        <button type="button" className={glass} aria-label={lessLabel} aria-disabled={atMin || undefined} onClick={() => set(current - step)}>
          <Icon name="minus" className="g-icon" />
        </button>
        <span className="g-bstep-v" aria-live="polite">
          <b>{current.toFixed(places)}</b>
          {unit && <span>{unit}</span>}
        </span>
        <button type="button" className={glass} aria-label={moreLabel} aria-disabled={atMax || undefined} onClick={() => set(current + step)}>
          <Icon name="plus" className="g-icon" />
        </button>
      </div>
      {hint && <span className="g-bstep-h">{hint}</span>}
    </div>
  )
}
