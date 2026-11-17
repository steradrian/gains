import { useRef, useState } from 'react'

// A segmented control for the stage (bundle.js `StageSegmented`: chart ranges, Week / 30d / 90d /
// All): glass track, a white thumb that slides with a slight overshoot. Two to five short options,
// never for moving between pages. `options` are strings or `{ value, label, href }`; `value` and
// `onChange(value)` make it controlled, otherwise it keeps its own. `label` names the group for a
// screen reader (`ariaLabel` is the same, `label` first). It is a radio group: the lit option is the
// only tab stop, and the arrow keys (Home, End) move the choice and the focus, mirrored in RTL.
// An option's `ariaLabel` is its spoken name when the visible one is a shortening ("1RM").
const normal = o => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value, href: o.href, ariaLabel: o.ariaLabel } : { value: o, label: o })

export default function StageSegmented({ options = [], value, onChange, label, ariaLabel }) {
  const opts = options.map(normal)
  const [own, setOwn] = useState(value !== undefined ? value : opts[0]?.value)
  const current = value !== undefined ? value : own
  const found = opts.findIndex(o => o.value === current)
  const at = Math.max(0, found)
  const refs = useRef([])
  const choose = i => {
    const o = opts[i]
    if (!o) return
    setOwn(o.value)
    onChange?.(o.value)
    refs.current[i]?.focus()
  }
  const onKeyDown = e => {
    const rtl = e.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[e.key]
    let to
    if (step) to = (at + step + opts.length) % opts.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = opts.length - 1
    if (to === undefined) return
    e.preventDefault()
    choose(to)
  }
  return (
    <div className="g-sseg g-glass" role="radiogroup" aria-label={label || ariaLabel} onKeyDown={onKeyDown} style={{ '--n': opts.length, '--i': at }}>
      <span className="g-sseg-thumb" aria-hidden="true" />
      {opts.map((o, i) => {
        const props = {
          ref: el => { refs.current[i] = el },
          role: 'radio',
          'aria-checked': i === at,
          'aria-label': o.ariaLabel,
          tabIndex: i === at ? 0 : -1,
          onClick: () => choose(i),
        }
        return o.href
          ? <a key={o.value} {...props} href={o.href}>{o.label}</a>
          : <button key={o.value} {...props} type="button">{o.label}</button>
      })}
    </div>
  )
}
