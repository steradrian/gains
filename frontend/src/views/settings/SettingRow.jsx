import Icon from '../../components/Icon.jsx'
import { cx } from '../../lib/ui-kit.js'
import './setting-rows.css'

// One row of a Settings page on the stage, inside a `.g-glist.g-glass` card: an icon disc, the
// title with a line under it, and what the row holds. A row with `onClick` is a button with a
// chevron (and its `value` before it); a row with `trailing` carries a switch or a button; a row
// with `below` puts a control (a segmented control) the full width under its text. `dim` is a
// setting this device can not do: shown, with the reason as `sub`, and out of reach.
// `title` is what a search hit flashes (useFlashRow looks the row up by `data-find`), so it is the
// row's visible, translated title.
export default function SettingRow({ icon, title, sub, value, onClick, trailing, below, dim = false }) {
  const kids = (
    <>
      {icon && <span className="g-glist-ic"><Icon name={icon} className="g-icon" /></span>}
      <span className="g-glist-body"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      {value != null && <span className="g-gvr-val">{value}</span>}
      {trailing}
      {onClick && <Icon name="chevronRight" className="g-icon g-glist-chev" />}
      {below && <div className="set-row-below">{below}</div>}
    </>
  )
  const cls = cx('g-glist-row g-gvr set-row', !onClick && 'g-gvr-static', below && 'set-row-stack', dim && 'set-row-dim')
  return onClick
    ? <button type="button" className={cls} data-find={title} onClick={onClick}>{kids}</button>
    : <div className={cls} data-find={title} aria-disabled={dim || undefined}>{kids}</div>
}
