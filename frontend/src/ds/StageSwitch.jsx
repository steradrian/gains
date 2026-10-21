import { useState } from 'react'
import { cx } from '../lib/ui-kit.js'
import { haptic as buzz } from '../lib/use-haptic.js'
import HapticSwitch from './HapticSwitch.jsx'

// An on/off switch for the stage (bundle.js `StageSwitch`: Filter by equipment, the Settings rows
// on glass). White knob on a glass track; lit, the track is white and the knob takes the accent.
// `checked` and `onChange(on)` make it controlled, otherwise it keeps its own. It is a `switch`
// button, so the caller names it: `label` (or `ariaLabel`, the same, `label` first) is its spoken
// name, and the visible text beside it is the caller's. There is no English default.
// A flipped switch is a write already made, so it ticks (ds/HapticSwitch.jsx), like the legacy
// Switch; `haptic={false}` for one that only previews. `disabled` dims it and ignores taps (a
// feature that is not available yet, or the last one of a group that has to keep one on).
export default function StageSwitch({ checked, onChange, label, ariaLabel, haptic = true, disabled = false }) {
  const [own, setOwn] = useState(!!checked)
  const on = checked !== undefined ? !!checked : own
  const toggle = () => {
    if (disabled) return
    if (haptic) buzz('selection')
    setOwn(!on)
    onChange?.(!on)
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label || ariaLabel} disabled={disabled} className={cx('g-sswitch', on && 'on', haptic && 'g-haptic')} onClick={toggle}>
      <i aria-hidden="true" />
      {haptic && <HapticSwitch />}
    </button>
  )
}
