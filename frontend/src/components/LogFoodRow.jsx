import Tag from '../ds/Tag.jsx'
import Icon from './Icon.jsx'

// One thing to log in the Log food drawer (board Ea8Search): a round glyph, the name and what one
// serving is, and the accent + that adds it. With `onOpen` the row and the + are two buttons: the
// row opens the food (Amount) and the + logs one serving at once, named aloud by `addLabel` ("Add
// Greek yogurt to Lunch"). Without it the whole row is the one button and the + only shows what a
// tap does (a saved meal logs all its foods). `tag` is a small label after the name (OFF).
export default function LogFoodRow({ icon = 'apple', title, subtitle, tag, onOpen, onAdd, addLabel, busy = false }) {
  const text = <>
    <span className="g-lf-lead" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
    <span className="g-lf-text">
      <span className="g-lf-line"><span className="g-lf-title">{title}</span>{tag && <Tag tone="muted">{tag}</Tag>}</span>
      {subtitle && <span className="g-lf-sub">{subtitle}</span>}
    </span>
  </>
  if (!onOpen) return (
    <button type="button" className="g-lf-row" onClick={busy ? undefined : onAdd} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
      {text}
      <span className="g-lf-add" aria-hidden="true"><Icon name="plus" className="g-icon" /></span>
    </button>
  )
  return (
    <div className="g-lf-item">
      <button type="button" className="g-lf-row" onClick={busy ? undefined : onOpen} aria-disabled={busy || undefined}>{text}</button>
      <button type="button" className="g-lf-add" onClick={busy ? undefined : onAdd} aria-label={addLabel} aria-disabled={busy || undefined}>
        <Icon name="plus" className="g-icon" />
      </button>
    </div>
  )
}
