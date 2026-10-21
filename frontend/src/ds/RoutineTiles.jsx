import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A stack shows at most this many pictures; the line under the name says how many there are.
const STACK = 3

// The Routines row on a Train tab root (board T2.0; the bundle has no part for it): glass tiles
// side by side that scroll sideways, each a stack of catalogue pictures, a name and a line
// ("6 exercises · Sun"). `items` are { key, title, sub, thumbs, icon, outline, href, onClick,
// play }: `thumbs` (urls; a null is a dumbbell tile) or `icon` (a disc, as Freestyle has),
// `outline` the unfilled tile Freestyle is, and `play` an optional round button in the corner,
// { label, onClick }, that starts it (the tile itself opens it). `label` names the row. Strings
// are the caller's.
export default function RoutineTiles({ items = [], label }) {
  return (
    <ul className="g-rtiles" aria-label={label}>
      {items.map(it => (
        <li key={it.key ?? it.title} className={cx('g-rtile', it.outline ? 'g-rtile-line' : 'g-glass')}>
          <Act href={it.href} onClick={it.onClick} className="g-rtile-open">
            {it.thumbs?.length > 0
              ? (
                <span className="g-rtile-stack" aria-hidden="true">
                  {it.thumbs.slice(0, STACK).map((src, i) => (
                    <span key={i}>{src ? <img src={src} alt="" width="36" height="36" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>}</span>
                  ))}
                </span>
              )
              : <span className="g-rtile-ic" aria-hidden="true"><Icon name={it.icon || 'dumbbell'} className="g-icon" /></span>}
            <span className="g-rtile-body"><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</span>
          </Act>
          {it.play && (
            <Act onClick={it.play.onClick} ariaLabel={it.play.label} className="g-rtile-play">
              <Icon name="play" className="g-icon" />
            </Act>
          )}
        </li>
      ))}
    </ul>
  )
}
