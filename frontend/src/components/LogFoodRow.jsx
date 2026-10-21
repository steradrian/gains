import HapticSwitch from '../ds/HapticSwitch.jsx'
import Tag from '../ds/Tag.jsx'
import { haptic as buzz } from '../lib/use-haptic.js'
import Icon from './Icon.jsx'

// One thing to log in the Log food drawer (board Ea8Search): a round glyph, the name and what one
// serving is, and the accent + that adds it. With `onOpen` the row and the + are two buttons: the
// row opens the food (Amount) and the + logs one serving at once, named aloud by `addLabel` ("Add
// Greek yogurt to Lunch"). Without it the whole row is the one button and the + only shows what a
// tap does (a saved meal logs all its foods). `tag` is a small label after the name (OFF).
// `haptic` is for an add that logs the food outright (ds/HapticSwitch.jsx); an add that opens the
// quantity sheet first leaves the tick to that sheet's Log button. A busy row neither adds nor ticks.
export default function LogFoodRow({ icon = 'apple', title, subtitle, tag, onOpen, onAdd, addLabel, busy = false, haptic = false }) {
  const tick = haptic && !busy
  const add = e => { if (tick) buzz('light'); onAdd?.(e) }
  const text = <>
    <span className="g-lf-lead" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
    <span className="g-lf-text">
      <span className="g-lf-line"><span className="g-lf-title">{title}</span>{tag && <Tag tone="muted">{tag}</Tag>}</span>
      {subtitle && <span className="g-lf-sub">{subtitle}</span>}
    </span>
  </>
  if (!onOpen) return (
    <button type="button" className={'g-lf-row' + (tick ? ' g-haptic' : '')} onClick={busy ? undefined : add} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
      {text}
      <span className="g-lf-add" aria-hidden="true"><Icon name="plus" className="g-icon" /></span>
      {tick && <HapticSwitch />}
    </button>
  )
  return (
    <div className="g-lf-item">
      <button type="button" className="g-lf-row" onClick={busy ? undefined : onOpen} aria-disabled={busy || undefined}>{text}</button>
      <button type="button" className={'g-lf-add' + (tick ? ' g-haptic' : '')} onClick={busy ? undefined : add} aria-label={addLabel} aria-disabled={busy || undefined}>
        <Icon name="plus" className="g-icon" />
        {tick && <HapticSwitch />}
      </button>
    </div>
  )
}
