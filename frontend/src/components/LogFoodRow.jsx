import Icon from './Icon.jsx'

// One thing to log in the Log food drawer (board T1.4): a round glyph, the name and what one
// serving is, and the accent + it adds with. The whole row is the button, named by what it shows.
export default function LogFoodRow({ icon = 'apple', title, subtitle, onAdd, busy = false }) {
  return (
    <button type="button" className="g-lf-row" onClick={busy ? undefined : onAdd} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
      <span className="g-lf-lead" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
      <span className="g-lf-text">
        <span className="g-lf-title">{title}</span>
        {subtitle && <span className="g-lf-sub">{subtitle}</span>}
      </span>
      <span className="g-lf-add" aria-hidden="true"><Icon name="plus" className="g-icon" /></span>
    </button>
  )
}
