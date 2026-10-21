import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

// The design system's list of actions under the tiles (bundle.js `MenuList`): a glyph, a label
// with an optional detail line, an optional value at the end. items: [{ icon, label, detail,
// value, tone: 'danger', onClick, disabled, ariaLabel }]; `value` may be a live node (a timer).
export default function MenuList({ items = [], label }) {
  return (
    <div className="g-menulist" role="menu" aria-label={label}>
      {items.map(x => (
        <button key={x.key ?? x.label} type="button" role="menuitem" onClick={x.onClick} disabled={x.disabled} aria-label={x.ariaLabel}
          className={cx('g-menuitem', x.tone && 'g-menuitem-' + x.tone)}>
          {x.icon && <Icon name={x.icon} className="g-icon" />}
          <span className="g-menuitem-body"><b>{x.label}</b>{x.detail && <span>{x.detail}</span>}</span>
          {x.value != null && <span className="g-menuitem-value">{x.value}</span>}
        </button>
      ))}
    </div>
  )
}
