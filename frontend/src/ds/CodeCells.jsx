import { useId, useState } from 'react'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'

// What the cells keep of whatever was typed or pasted; screens use it for a code that comes from
// somewhere else (the clipboard, a link).
export const cleanCode = (text, length) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length)
const clean = cleanCode

// A short code as one-time-code cells over one real input, so the keyboard's suggestion, a paste
// and the device's autofill all land in it: letters are uppercased and anything but A–Z and 0–9
// is dropped. `invalid` draws the cells amber. Controlled with `value` and `onChange`, else it
// keeps its own. The input has no maxLength of its own: a code pasted with its dashes
// ("K7WQ-2MZP-4HXA") is longer than the cells and the browser would cut it before the dashes
// are dropped. More than six cells wrap into rows of six. `inputRef` is the input.
export default function CodeCells({ length = 6, value, onChange, invalid, numeric, label, inputRef }) {
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
      <input ref={inputRef} id={id} value={v} inputMode={numeric ? 'numeric' : 'text'} autoComplete="one-time-code"
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} dir="ltr" aria-label={label || t('Code')} aria-invalid={invalid ? 'true' : undefined} onChange={change} />
      {Array.from({ length }, (_, k) => (
        <span key={k} aria-hidden="true" data-glass="flat" className={cx('g-code-cell g-glass', invalid && 'bad', k === v.length && !invalid && 'cur')}>{v[k] || ''}</span>
      ))}
    </label>
  )
}
