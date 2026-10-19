import { useId } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

// A labelled field for editors: the label always visible above the box (never a placeholder in
// its place), a unit after the value, one hint line under it. `tone="stage"` puts it on glass
// with white text. Uncontrolled: `value` (or `defaultValue`) is the starting text and `onChange`
// gets each new one. The whole field is its <label>, so a tap anywhere on it focuses the input;
// the input is named by the label and unit alone ("Weight kg"), and the hint describes it.
export default function TextField({ label, value, defaultValue, unit, placeholder, inputMode, hint, wide, onChange, tone }) {
  oneOf('TextField', 'tone', tone, ['light', 'stage'])
  const id = useId()
  const labelId = id + '-label', unitId = id + '-unit', hintId = id + '-hint'
  return (
    <label className={cx('g-tfield', wide && 'g-tfield-wide', tone === 'stage' && 'g-tfield-stage')} htmlFor={id}>
      <span className="g-tfield-label" id={labelId}>{label}</span>
      <span className="g-tfield-box">
        <input id={id} defaultValue={value != null ? value : defaultValue} placeholder={placeholder} inputMode={inputMode}
          aria-labelledby={unit ? labelId + ' ' + unitId : labelId} aria-describedby={hint ? hintId : undefined}
          onChange={onChange && (e => onChange(e.target.value))} />
        {unit && <span className="g-tfield-unit" id={unitId}>{unit}</span>}
      </span>
      {hint && <span className="g-tfield-hint" id={hintId}>{hint}</span>}
    </label>
  )
}
