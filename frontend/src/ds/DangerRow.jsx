import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A destructive row on the stage (bundle.js `DangerRow`, the Account page's Start over and Delete
// account). It never deletes by itself: it opens the ConfirmDrawer (R5) or a page that explains
// what goes. `first: false` draws the hairline above a row that follows another. Strings come
// from the caller.
export default function DangerRow({ icon = 'trash', title, sub, href, onClick, first = true }) {
  return (
    <Act href={href} onClick={onClick} className={cx('g-danger-row', !first && 'g-danger-line')}>
      <span className="g-danger-ic"><Icon name={icon} className="g-icon" /></span>
      <span className="g-danger-b"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <Icon name="chevronRight" className="g-icon" />
    </Act>
  )
}
