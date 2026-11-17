import { useId, useState } from 'react'
import { cx } from '../lib/ui-kit.js'
import { haptic as buzz } from '../lib/use-haptic.js'
import HapticSwitch from './HapticSwitch.jsx'

// The light switch for drawers (bundle.js `Switch`; board W1.21 Workout settings). A
// `role="switch"` button. With `label` it is the whole row (title, the optional `description`
// under it, the switch at the end); without, just the switch, named by `ariaLabel`. Controlled
// with `onChange(on)` and `checked`, else it keeps its own state. `disabled` greys it and
// ignores taps. The stage's switch is `StageSwitch`; this one is for light surfaces only.
// Every string comes from the caller.
export default function Switch({ checked = false, onChange, label, description, ariaLabel, disabled = false, haptic = false }) {
  const [own, setOwn] = useState(!!checked)
  const on = onChange ? !!checked : own
  const labelId = useId()
  const descId = useId()
  const toggle = () => {
    if (disabled) return
    if (haptic) buzz('selection')
    setOwn(!on)
    onChange?.(!on)
  }
  // `haptic`: a flipped switch that is a write already made ticks (ds/StageSwitch does the same).
  const ticks = haptic && !disabled
  const control = (
    <button type="button" role="switch" className={cx('g-switch', ticks && 'g-haptic')} aria-checked={on ? 'true' : 'false'} disabled={disabled}
      aria-labelledby={label ? labelId : undefined} aria-label={label ? undefined : ariaLabel}
      aria-describedby={label && description ? descId : undefined} onClick={toggle}>
      {ticks && <HapticSwitch />}
    </button>
  )
  if (!label) return control
  return (
    <div className="g-switchrow">
      <div>
        <div id={labelId} className="g-switch-title">{label}</div>
        {description && <div id={descId} className="g-switch-sub">{description}</div>}
      </div>
      {control}
    </div>
  )
}
