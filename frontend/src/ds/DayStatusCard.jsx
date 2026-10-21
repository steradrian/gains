import ExerciseStillImg from '../components/ExerciseStillImg.jsx'
import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import Tag from './Tag.jsx'

const TONES = ['plain', 'warn', 'off']
// The planned workout's stills show at most this many.
const STACK = 6

// What a section of a Day page says when it has no workout or food to draw (boards Sh1DayRest,
// Sh1DayMissed, Sh1Skipped, Sh1DayOff; the bundle has no card for it): a glass card with a glyph
// on a disc, a title and a line, a `tag` at the end ("Skipped"), then optionally the planned
// workout's stills (`stills`, exercise ids, each drawn by ExerciseStillImg so a custom exercise
// shows its own; or `thumbs`, urls, a null a dumbbell tile, for a sample), drawn faded because
// nothing was done, and pill buttons, `actions: [{ label, solid, href, onClick }]`, the white one `solid`.
// `tone`: plain; warn, the amber disc of a missed workout; off, a feature that is off (the line
// greys, the title stays white). Every string is the caller's.
export default function DayStatusCard({ icon = 'info', tone = 'plain', title, body, tag, stills, thumbs, actions = [] }) {
  oneOf('DayStatusCard', 'tone', tone, TONES)
  const stack = stills?.length
    ? stills.slice(0, STACK).map(id => <ExerciseStillImg id={id} size="44" />)
    : thumbs?.slice(0, STACK).map(src => (src ? <img src={src} alt="" width="44" height="44" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>))
  return (
    <div className={cx('g-dstat g-glass', tone !== 'plain' && 'g-dstat-' + tone)}>
      <div className="g-dstat-head">
        <span className="g-dstat-ic" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>
        <span className="g-dstat-b"><b>{title}</b>{body && <span>{body}</span>}</span>
        {tag && <Tag tone="glass">{tag}</Tag>}
      </div>
      {stack?.length > 0 && (
        <div className="g-dstat-stack" aria-hidden="true">
          {stack.map((still, i) => <span key={i}>{still}</span>)}
        </div>
      )}
      {actions.length > 0 && (
        <div className="g-dstat-acts">
          {actions.map(a => (
            <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-dstat-btn', a.solid && 'solid')}>{a.label}</Act>
          ))}
        </div>
      )}
    </div>
  )
}
