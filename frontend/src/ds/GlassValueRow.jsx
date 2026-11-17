import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

// A row on the stage with a bold tabular value before the chevron (weigh-ins, measurements,
// targets; bundle.js `GlassValueRow`). Stack them inside a `.g-glist.g-glass` card, or GlassList's.
// With `href` or `onClick` it is a link or a button with a chevron; with `static`, or neither, a
// plain div for a fact that opens nothing, so nothing looks tappable that is not. `trailing`
// replaces the chevron; `chevron={false}` drops it from a tappable row.
export default function GlassValueRow({ icon, title, sub, value, href, onClick, static: fixed = false, trailing, chevron = true }) {
  const tappable = !fixed && !!(href || onClick)
  const cls = tappable ? 'g-glist-row g-gvr' : 'g-glist-row g-gvr g-gvr-static'
  const kids = (
    <>
      {icon && <span className="g-glist-ic"><Icon name={icon} className="g-icon" /></span>}
      <span className="g-glist-body"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      {value != null && <span className="g-gvr-val">{value}</span>}
      {trailing}
      {tappable && chevron && !trailing && <Icon name="chevronRight" className="g-icon g-glist-chev" />}
    </>
  )
  return tappable
    ? <Act href={href} onClick={onClick} className={cls}>{kids}</Act>
    : <div className={cls}>{kids}</div>
}
