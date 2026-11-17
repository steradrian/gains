import { useState } from 'react'
import { isIos, useHapticsEnabled } from '../lib/use-haptic.js'

export const HAPTIC_SWITCH_SLOT = 'haptic-switch'

/** True when a click's target is the overlay switch rather than the control holding it. */
export const isHapticSwitchTarget = target => typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && target.dataset.slot === HAPTIC_SWITCH_SLOT

// The only haptic iOS Safari has left. WebKit plays the system toggle tick when an
// <input type="checkbox" switch> flips under the user's finger, and since iOS 26.5 under the
// finger is the only way (a programmatic click on the input or its label no longer counts,
// WebKit #65327). So the switch goes INSIDE the control, stretched over it and invisible
// (ds.css .g-hsw), and the tap that lands on the control lands on the switch first. The click then
// bubbles to the control's own handler as usual.
//
// What the host must do:
//   - be positioned, so the switch fills it: add `g-haptic` to its classes;
//   - not call preventDefault() on the click: that cancels the toggle, and the toggle is the tick;
//   - if it is type="submit", submit explicitly: the click target is the switch, so the button's
//     implicit submission never runs (ds/Button does it with form.requestSubmit()).
//
// Renders nothing off iOS, and nothing with Settings → Haptics off. Keyboard and assistive-tech
// activation land on the host, not the switch, and stay silent. It is out of the tab order and the
// accessibility tree, and mirrors the host's `disabled`: a disabled switch neither flips nor ticks.
// It is opacity 0, never display none: a switch that is not rendered does not tick.
export default function HapticSwitch({ disabled = false }) {
  const [ios] = useState(isIos)
  const on = useHapticsEnabled()
  if (!ios || !on) return null
  return (
    <input
      type="checkbox"
      // WebKit's non-standard attribute, set by hand so React cannot drop it.
      ref={el => el?.setAttribute('switch', '')}
      className="g-hsw"
      data-slot={HAPTIC_SWITCH_SLOT}
      aria-hidden="true"
      tabIndex={-1}
      disabled={disabled}
    />
  )
}
