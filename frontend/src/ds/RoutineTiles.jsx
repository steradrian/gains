import ExerciseStillImg from '../components/ExerciseStillImg.jsx'
import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A stack shows at most this many pictures; the line under the name says how many there are.
const STACK = 3

// What fills a tile's stack: the exercises' own pictures (`stills`, ids), else bare urls.
const slotsOf = it => (it.stills?.length
  ? it.stills.slice(0, STACK).map(id => <ExerciseStillImg id={id} size="36" />)
  : (it.thumbs || []).slice(0, STACK).map(src => (src ? <img src={src} alt="" width="36" height="36" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>)))

// The Routines row on a Train tab root (board T2.0; the bundle has no part for it): glass tiles
// side by side that scroll sideways, each a stack of exercise pictures, a name and a line
// ("6 exercises · Sun"). `items` are { key, title, sub, stills, thumbs, icon, outline, href,
// onClick, play }: `stills` (exercise ids, each drawn by ExerciseStillImg, so a custom exercise
// shows its own picture) or `thumbs` (urls; a null is a dumbbell tile, for a fixture with no
// exercise behind it) or `icon` (a disc, as Freestyle has), `outline` the unfilled tile Freestyle
// is, and `play` an optional round button in the corner, { label, onClick }, that starts it (the
// tile itself opens it). `label` names the row. Strings are the caller's.
export default function RoutineTiles({ items = [], label }) {
  return (
    <ul className="g-rtiles" aria-label={label}>
      {items.map(it => {
        const slots = slotsOf(it)
        return (
          <li key={it.key ?? it.title} className={cx('g-rtile', it.outline ? 'g-rtile-line' : 'g-glass')}>
            <Act href={it.href} onClick={it.onClick} className="g-rtile-open">
              {slots.length > 0
                ? <span className="g-rtile-stack" aria-hidden="true">{slots.map((slot, i) => <span key={i}>{slot}</span>)}</span>
                : <span className="g-rtile-ic" aria-hidden="true"><Icon name={it.icon || 'dumbbell'} className="g-icon" /></span>}
              <span className="g-rtile-body"><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</span>
            </Act>
            {it.play && (
              <Act onClick={it.play.onClick} ariaLabel={it.play.label} className="g-rtile-play">
                <Icon name="play" className="g-icon" />
              </Act>
            )}
          </li>
        )
      })}
    </ul>
  )
}
