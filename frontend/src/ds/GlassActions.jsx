import Icon from '../components/Icon.jsx'
import { haptic as buzz } from '../lib/use-haptic.js'
import Act from './Act.jsx'
import HapticSwitch from './HapticSwitch.jsx'

const SKELETON_COUNT = 4

// The round glass actions under Today's hero, labels below (bundle.js `GlassActions`): three or
// four of them, one short word each, never an icon alone. items: [{ icon, label, onClick, href, haptic }]; `haptic` ticks a tap that commits something (water).
// `loading` draws bare discs in their place (board T11Loading); `items` then only sets how many.
export default function GlassActions({ items = [], loading }) {
  const count = loading ? items.length || SKELETON_COUNT : items.length
  return (
    <div className="g-gacts" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} aria-hidden={loading ? 'true' : undefined}>
      {loading
        ? Array.from({ length: count }, (_, i) => <i key={i} className="g-skel g-gact-sk" />)
        : items.map((a, i) => (
          <Act key={i} href={a.href} className={a.haptic && !a.href ? 'g-gact g-haptic' : 'g-gact'}
            onClick={a.haptic ? (e => { buzz('light'); a.onClick?.(e) }) : a.onClick}>
            <span className="g-glass" data-glass="control"><Icon name={a.icon} className="g-icon" /></span>
            {a.label}
            {a.haptic && !a.href && <HapticSwitch />}
          </Act>
        ))}
    </div>
  )
}
