import { useLayoutEffect, useRef, useState } from 'react'

// The design system's text tabs (bundle.js `Tabs`): switch what one page or drawer shows (the
// exercise drawer's How to, Progress, History). The chosen label turns `text`, and a 2.5px line
// slides and resizes to it. `options` are strings or { value, label }; the caller names the strip
// (`label`, or `ariaLabel` as slices 4–6 spell it). Controlled with `value` and `onChange`, else it
// keeps its own choice. A tablist: one tab stop, the arrow keys (mirrored right to left), Home and
// End move between the tabs and choose as they go. `controls` is the id of the panel they show.
export default function Tabs({ options, value, onChange, label, ariaLabel, controls }) {
  const opts = options.map(o => (typeof o === 'string' ? { v: o, l: o } : { v: o.value, l: o.label }))
  const [own, setOwn] = useState(value ?? opts[0].v)
  const val = onChange && value != null ? value : own
  const refs = useRef({})
  const [ink, setInk] = useState({ x: 0, w: 0, ready: false })

  // offsetLeft is a physical measure, so the line is placed from the physical left too (ds.css).
  useLayoutEffect(() => {
    const place = () => {
      const b = refs.current[val]
      if (b) setInk({ x: b.offsetLeft, w: b.offsetWidth, ready: true })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [val, opts.length])

  const choose = v => { setOwn(v); onChange?.(v) }
  const onKeyDown = e => {
    const i = opts.findIndex(o => o.v === val)
    const rtl = e.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key]
    const to = step ? (i + step + opts.length) % opts.length : e.key === 'Home' ? 0 : e.key === 'End' ? opts.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    choose(opts[to].v)
    refs.current[opts[to].v]?.focus()
  }

  return (
    <div className="g-tabs" role="tablist" aria-label={label || ariaLabel} onKeyDown={onKeyDown}>
      {opts.map(o => (
        <button key={o.v} type="button" role="tab" aria-selected={String(val === o.v)} aria-controls={controls}
          tabIndex={val === o.v ? 0 : -1} ref={el => { refs.current[o.v] = el }} onClick={() => choose(o.v)}>
          {o.l}
        </button>
      ))}
      <span className="g-tabs-ink" aria-hidden="true"
        style={{ width: ink.w, transform: `translateX(${ink.x}px)`, opacity: ink.ready ? 1 : 0 }} />
    </div>
  )
}
