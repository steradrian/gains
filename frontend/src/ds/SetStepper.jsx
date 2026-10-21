import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { dateLocale } from '../lib/i18n.js'

// A value is kept to two places, so 0.1 + 0.2 steps never leave 0.30000000000000004 behind.
const round = v => Math.round(v * 100) / 100

// One number to set, on the stage (board W1.2): the label over a − value + row and a hint under it
// ("2.5 kg steps"). The value is an input (inputMode decimal) so a number can be typed as well as
// stepped; it is named by the label. `value` + `onChange(v)` make it controlled, `defaultValue`
// leaves it to the component. Both buttons stop at `min` (0 unless given) and step by `step`;
// `decimals` is how many places the value shows (one when the step is fractional). The spoken
// names of the buttons ("Less kg", "More Reps") are `lessLabel` and `moreLabel`; every string is
// the caller's. A typed value commits on every valid keystroke and the text is tidied on blur.
export default function SetStepper({ label, value, defaultValue = 0, step = 1, decimals, min = 0, hint, onChange, lessLabel, moreLabel }) {
  const [own, setOwn] = useState(defaultValue)
  const [draft, setDraft] = useState(null)
  const current = value ?? own
  const places = decimals ?? (step % 1 ? 1 : 0)
  const show = v => Number(v).toLocaleString(dateLocale(), { maximumFractionDigits: places })

  const set = v => {
    const next = Math.max(min, round(v))
    if (value == null) setOwn(next)
    onChange?.(next)
  }
  const type = e => {
    const text = e.target.value
    setDraft(text)
    const n = Number(text.replace(',', '.'))
    if (text.trim() !== '' && Number.isFinite(n) && n >= min) set(n)
  }

  return (
    <div className="g-sst g-glass" role="group" aria-label={label}>
      <span className="g-sst-l">{label}</span>
      <div className="g-sst-row">
        <button type="button" className="g-sst-b" aria-label={lessLabel} onClick={() => set(current - step)}>
          <Icon name="minus" className="g-icon" />
        </button>
        <input
          className="g-sst-v"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          value={draft ?? show(current)}
          onChange={type}
          onFocus={e => e.target.select()}
          onBlur={() => setDraft(null)}
        />
        <button type="button" className="g-sst-b" aria-label={moreLabel} onClick={() => set(current + step)}>
          <Icon name="plus" className="g-icon" />
        </button>
      </div>
      {hint && <span className="g-sst-h">{hint}</span>}
    </div>
  )
}
