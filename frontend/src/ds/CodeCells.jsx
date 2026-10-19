import { useId, useState } from 'react'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'

const clean = (text, length) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length)

// A short code as one-time-code cells over one real input, so the keyboard's suggestion, a paste
// and the device's autofill all land in it: letters are uppercased and anything but A–Z and 0–9
// is dropped. `invalid` draws the cells amber. Controlled with `value` and `onChange`, else it
// keeps its own.
export default function CodeCells({ length = 6, value, onChange, invalid, numeric, label }) {
  const [own, setOwn] = useState(value != null ? value : '')
  const v = clean(onChange && value != null ? value : own, length)
  const id = useId()
  const change = e => {
    const next = clean(e.target.value, length)
    setOwn(next)
    onChange?.(next)
  }
  return (
    <label className="g-code" htmlFor={id}>
      <input id={id} value={v} inputMode={numeric ? 'numeric' : 'text'} autoComplete="one-time-code" maxLength={length}
        aria-label={label || t('Code')} aria-invalid={invalid ? 'true' : undefined} onChange={change} />
      {Array.from({ length }, (_, k) => (
        <span key={k} aria-hidden="true" className={cx('g-code-cell g-glass', invalid && 'bad', k === v.length && !invalid && 'cur')}>{v[k] || ''}</span>
      ))}
    </label>
  )
}
