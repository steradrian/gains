import { useId, useRef, useState } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

const TONES = ['light', 'stage']

// Reps in the tank, one pill per answer (bundle.js `EffortChips`; board W1.12 Set edit draws them
// as wrapping pills such as "0 · failure", "1", "4+"). `options` are strings or { value, label },
// `label` names the group (spoken and shown above), `hint` is the line under it. `value` (null
// for no answer yet) and `onChange(value)` make it controlled, else it keeps its own. `tone="stage"`
// is for the running screen under the set just done. A radio group with one tab stop: the arrows
// move and choose. Every string comes from the caller.
const normal = o => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o })

export default function EffortChips({ options = [], value, onChange, label, hint, tone = 'light' }) {
  oneOf('EffortChips', 'tone', tone, TONES)
  const opts = options.map(normal)
  const [own, setOwn] = useState(null)
  const current = value !== undefined ? value : own
  const labelId = useId()
  const hintId = useId()
  const row = useRef(null)
  const pick = v => {
    setOwn(v)
    onChange?.(v)
  }
  const step = (e, i) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!dir || !opts.length) return
    e.preventDefault()
    const to = (i + dir + opts.length) % opts.length
    row.current?.querySelectorAll('[role="radio"]')[to]?.focus()
    pick(opts[to].value)
  }
  const stop = Math.max(0, opts.findIndex(o => o.value === current))
  return (
    <div className={cx('g-effort', tone === 'stage' && 'g-effort-stage')}>
      {label && <span id={labelId} className="g-effort-l">{label}</span>}
      <div className="g-effort-row" role="radiogroup" aria-labelledby={label ? labelId : undefined}
        aria-describedby={hint ? hintId : undefined} ref={row}>
        {opts.map((o, i) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === current ? 'true' : 'false'}
            tabIndex={i === stop ? 0 : -1} onClick={() => pick(o.value)} onKeyDown={e => step(e, i)}>{o.label}</button>
        ))}
      </div>
      {hint && <span id={hintId} className="g-effort-h">{hint}</span>}
    </div>
  )
}
