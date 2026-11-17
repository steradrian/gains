import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'
import BodyMap from './BodyMap.jsx'

// "Muscles this week" on a Train tab root (board T2.0; the bundle has no card for it): a glass
// card with a title and the period beside it, the body front and back shaded by `levels`
// ({ slug: 0..4 }, BodyMap), a line under it ("Legs not trained yet") and a link word with a
// chevron ("Training load"). The whole card is the link (`href` or `onClick`). `mapLabel` names
// the pictures for a screen reader; without it they are decoration. Strings are the caller's.
export default function MusclesCard({ title, period, levels, note, action, href, onClick, mapLabel }) {
  const kids = (
    <>
      <span className="g-mcard-head"><b>{title}</b>{period && <span>{period}</span>}</span>
      <span className="g-mcard-map"><BodyMap levels={levels} width={118} label={mapLabel} /></span>
      <span className="g-mcard-foot">
        <span>{note}</span>
        {action && <span className="g-mcard-act">{action}<Icon name="chevronRight" className="g-icon" /></span>}
      </span>
    </>
  )
  return href || onClick
    ? <Act href={href} onClick={onClick} className="g-mcard g-glass">{kids}</Act>
    : <div className="g-mcard g-glass">{kids}</div>
}
