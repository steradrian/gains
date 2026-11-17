import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const SIZES = ['md', 'lg']

// The design system's action tiles at the top of the + sheet (bundle.js `ActionGrid`): an icon on
// a sunken tile, a short label under it. items: [{ icon, label, accent, detail, onClick, href,
// disabled, ariaLabel }]; `accent` fills one tile (the screen's main action), `detail` is a line
// under the label (a running workout's time). `size`: md, four across (the bundle's), or lg, three
// across with the glyph on an accent disc (board T18Add).
export default function ActionGrid({ items = [], size = 'md' }) {
  oneOf('ActionGrid', 'size', size, SIZES)
  return (
    <div className={cx('g-agrid', size === 'lg' && 'g-agrid-lg')}>
      {items.map(a => (
        <Act key={a.label} href={a.href} onClick={a.onClick} disabled={a.disabled} ariaLabel={a.ariaLabel}
          className={cx('g-atile', a.accent && 'g-atile-accent')}>
          <span><Icon name={a.icon} className="g-icon" /></span>
          {a.label}
          {a.detail != null && <small className="g-atile-detail">{a.detail}</small>}
        </Act>
      ))}
    </div>
  )
}
