import { useState } from 'react'

// The design system's segmented control (bundle.js `SegmentedControl`): 2–3 short, exclusive
// choices on a sunken pill track, the chosen one lifted onto the surface by a thumb that slides.
// `options` are strings or { value, label }; `label` names the group. Controlled with `value` and
// `onChange`, else it keeps its own choice.
export default function SegmentedControl({ options, value, onChange, label }) {
  const opts = options.map(o => (typeof o === 'string' ? { v: o, l: o } : { v: o.value, l: o.label }))
  const [own, setOwn] = useState(value ?? opts[0].v)
  const val = onChange && value != null ? value : own
  const idx = Math.max(0, opts.findIndex(o => o.v === val))
  return (
    <div className="g-seg" role="group" aria-label={label} style={{ '--n': opts.length, '--i': idx }}>
      <span className="g-seg-thumb" aria-hidden="true" />
      {opts.map(o => (
        <button key={o.v} type="button" aria-pressed={String(val === o.v)} onClick={() => { setOwn(o.v); onChange?.(o.v) }}>{o.l}</button>
      ))}
    </div>
  )
}
