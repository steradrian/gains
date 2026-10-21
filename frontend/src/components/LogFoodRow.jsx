import { haptic as buzz } from '../lib/use-haptic.js'
import HapticSwitch from '../ds/HapticSwitch.jsx'
import Icon from './Icon.jsx'

// One thing to log in the Log food drawer (board T1.4): a round glyph, the name and what one
// serving is, and the accent + it adds with. The whole row is the button, named by what it shows.
// `haptic` is for a row whose tap logs the food outright (ds/HapticSwitch.jsx); a row that opens
// the quantity sheet first leaves the tick to that sheet's Log button. A busy row neither adds nor ticks.
export default function LogFoodRow({ icon = 'apple', title, subtitle, onAdd, busy = false, haptic = false }) {
  const tick = haptic && !busy
  const add = e => { if (tick) buzz('light'); onAdd?.(e) }
  return (
    <button type="button" className={'g-lf-row' + (tick ? ' g-haptic' : '')} onClick={busy ? undefined : add} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
      <span className="g-lf-lead" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
      <span className="g-lf-text">
        <span className="g-lf-title">{title}</span>
        {subtitle && <span className="g-lf-sub">{subtitle}</span>}
      </span>
      <span className="g-lf-add" aria-hidden="true"><Icon name="plus" className="g-icon" /></span>
      {tick && <HapticSwitch />}
    </button>
  )
}
