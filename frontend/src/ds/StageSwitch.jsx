import { useState } from 'react'

// An on/off switch for the stage (bundle.js `StageSwitch`: Filter by equipment, the Settings rows
// on glass). White knob on a glass track; lit, the track is white and the knob takes the accent.
// `checked` and `onChange(on)` make it controlled, otherwise it keeps its own. It is a `switch`
// button, so the caller names it: `label` (or `ariaLabel`, the same, `label` first) is its spoken
// name, and the visible text beside it is the caller's. There is no English default.
export default function StageSwitch({ checked, onChange, label, ariaLabel }) {
  const [own, setOwn] = useState(!!checked)
  const on = checked !== undefined ? !!checked : own
  const toggle = () => {
    setOwn(!on)
    onChange?.(!on)
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label || ariaLabel} className={on ? 'g-sswitch on' : 'g-sswitch'} onClick={toggle}>
      <i aria-hidden="true" />
    </button>
  )
}
