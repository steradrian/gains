import { useState } from 'react'
import { cx, oneOf } from '../lib/ui-kit.js'

// Pill chips for a single choice (bundle.js `ChipGroup`: fasting plans, activity types, muscle
// filters). `options` are strings or `{ value, label, href }`; `value` and `onChange(value)` make
// it controlled, otherwise it keeps its own. `scroll` is one horizontal row instead of wrapping.
// `tone` is `light` (a drawer or page) or `stage`. `label` names the group for a screen reader
// (`ariaLabel` is the same, `label` first). Each chip is a toggle: `aria-pressed` on a button,
// `aria-current` on a link. The chip stays inside this file; the stage filter chip is ds/Chip.jsx.
// `multi` takes several: `value` is then an array, and a tap calls `onChange(next, tapped)` with
// the array that tap leaves and the chip's own value, so a caller with rules about which chips
// go together can apply them.
const TONES = ['light', 'stage']
const normal = o => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value, href: o.href } : { value: o, label: o })

export default function ChipGroup({ options = [], value, onChange, scroll = false, tone = 'light', label, ariaLabel, multi = false }) {
  oneOf('ChipGroup', 'tone', tone, TONES)
  const opts = options.map(normal)
  const [own, setOwn] = useState(value !== undefined ? value : multi ? [] : opts[0]?.value)
  const current = value !== undefined ? value : own
  const isOn = v => (multi ? (current || []).includes(v) : v === current)
  const pick = v => {
    if (!multi) { setOwn(v); onChange?.(v); return }
    const list = current || []
    const next = list.includes(v) ? list.filter(x => x !== v) : [...list, v]
    setOwn(next)
    onChange?.(next, v)
  }
  return (
    <div className={cx('g-cgroup', scroll && 'g-cgroup-scroll', tone === 'stage' && 'g-cgroup-stage')} role="group" aria-label={label || ariaLabel}>
      {opts.map(o => {
        const on = isOn(o.value)
        const cls = cx('g-cchip', on && 'on')
        return o.href
          ? <a key={o.value} href={o.href} className={cls} aria-current={on ? 'true' : undefined} onClick={() => pick(o.value)}>{o.label}</a>
          : <button key={o.value} type="button" className={cls} aria-pressed={on} onClick={() => pick(o.value)}>{o.label}</button>
      })}
    </div>
  )
}
