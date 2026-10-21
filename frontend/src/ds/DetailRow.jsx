import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The row of a light drawer or page (bundle.js `DetailRow`): an optional round icon (`tint` puts
// it on the accent tint), the title and a `sub` line, a `value` at the end, and a chevron when it
// goes somewhere (`href` or `onClick`; `chevron={false}` hides it). `trailing` (a switch, a
// button) takes the chevron's place. `danger` turns the title red (Delete). Rows that follow one
// another are ruled. Its spoken name is its text; it builds no label of its own. Not on the stage:
// GlassRow is the stage's.
export default function DetailRow({ icon, tint, title, sub, value, href, onClick, chevron, trailing, danger }) {
  const tap = !!(href || onClick)
  const kids = (
    <>
      {icon && <span className={cx('g-drow-ic', tint && 'g-drow-ic-tint')}><Icon name={icon} className="g-icon" /></span>}
      <span className="g-drow-body"><b className={danger ? 'g-danger' : undefined}>{title}</b>{sub && <span>{sub}</span>}</span>
      {value != null && <span className="g-drow-val">{value}</span>}
      {trailing}
      {tap && chevron !== false && !trailing && <Icon name="chevronRight" className="g-icon g-drow-chev" />}
    </>
  )
  return tap ? <Act href={href} onClick={onClick} className="g-drow">{kids}</Act> : <div className="g-drow">{kids}</div>
}
