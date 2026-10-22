import Icon from '../Icon.jsx'
import { NumberField } from '../ui.jsx'

// A number you can type or nudge with - and + (the Amount step's serving size and servings). The
// number never goes to 0 or below by a nudge; a typed 0 is the caller's to refuse. `label` is the
// field's name; `lessLabel` and `moreLabel` are what the buttons say aloud, worded by the caller
// with the unit ("Less 10 g").
export default function LogStepper({ label, value, onChange, step = 1, unit, lessLabel, moreLabel, autoFocus = false }) {
  const current = Number(value) || 0
  const bump = dir => {
    const next = Math.round((current + dir * step) * 100) / 100
    if (next > 0) onChange(next)
  }
  return (
    <div className="g-la-field">
      <span className="g-la-flabel">{label}</span>
      <div className="g-la-stp">
        <button type="button" className="g-la-btn" aria-label={lessLabel} aria-disabled={current - step <= 0 || undefined} onClick={() => bump(-1)}>
          <Icon name="minus" className="g-icon" />
        </button>
        <span className="g-la-val">
          <NumberField value={value} onChange={onChange} aria-label={label} autoFocus={autoFocus} />
          {unit && <span className="g-la-unit">{unit}</span>}
        </span>
        <button type="button" className="g-la-btn" aria-label={moreLabel} onClick={() => bump(1)}>
          <Icon name="plus" className="g-icon" />
        </button>
      </div>
    </div>
  )
}
