import { haptic as buzz } from '../lib/use-haptic.js'

// A slider on the stage for a strength from 0 to 1 (the Background page's Intensity): Quiet and
// Bold at the ends, the value as a percentage, a native range input under them so the keyboard and
// a screen reader get it for free. `value` is controlled. `onChange(v)` hears every step while the
// thumb moves (the preview), `onCommit(v)` once when it is let go or a key is released (the write).
// The release ticks (`haptic={false}` for a preview). `label` is its spoken name; `minLabel` and
// `maxLabel` are the end captions, all from the caller through t().
const pct = v => Math.round(Math.min(1, Math.max(0, v)) * 100)

export default function StageSlider({ value, onChange, onCommit, label, minLabel, maxLabel, haptic = true }) {
  const p = pct(value)
  const commit = e => {
    if (haptic) buzz('selection')
    onCommit?.(Number(e.currentTarget.value) / 100)
  }
  return (
    <div className="g-sslider">
      <div className="g-sslider-ends">
        <span>{minLabel}</span>
        <b aria-hidden="true">{p}%</b>
        <span>{maxLabel}</span>
      </div>
      <input type="range" className="g-sslider-input" min={0} max={100} step={1} value={p} aria-label={label}
        aria-valuetext={`${p}%`} style={{ '--fill': p + '%' }}
        onChange={e => onChange?.(Number(e.target.value) / 100)}
        onPointerUp={commit} onKeyUp={commit} />
    </div>
  )
}
