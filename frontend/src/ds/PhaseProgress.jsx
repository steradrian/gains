import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const TONES = ['warm', 'main', 'cool']
const STATES = ['done', 'now', 'waiting']
// A phase with more segments than this draws them with 3px gaps instead of 4 (board W1.44, 20 exercises).
const LONG = 8

// The phase bar under the top of the workout (boards W1.0, W1.32, W1.44, W1.9): the phase being
// worked is drawn open, one segment per exercise; the others fold into a pill, a check once done
// and their count while they wait. Warm-up is peach, cool-down mint, the workout itself white.
// The whole bar is one control that opens the map, named by `label` (the caller's "All exercises").
//
// phases: [{ tone: 'warm' | 'main' | 'cool', count, state: 'done' | 'now' | 'waiting', name?, countLabel? }]
// in the order they run; `name` is the pill's tooltip, `countLabel` the number as the caller writes
// it. A phase with count 0 is not drawn. `done` is how many segments of the open phase are finished,
// `index` the one being worked and `partial` (0…1) how far through it is.
export default function PhaseProgress({ phases = [], index = 0, done = 0, partial = 0, href, onOpen, label }) {
  const shown = phases.filter(ph => ph.count > 0)
  if (!shown.length) return null
  const kids = shown.map((ph, i) => {
    oneOf('PhaseProgress', 'tone', ph.tone, TONES)
    oneOf('PhaseProgress', 'state', ph.state, STATES)
    if (ph.state === 'now') {
      const pct = Math.round(Math.min(Math.max(partial, 0), 1) * 100) + '%'
      return (
        <span key={i} className={cx('g-pp-run', 'g-pp-' + ph.tone, ph.count > LONG && 'g-pp-long')}>
          {Array.from({ length: ph.count }, (_, k) => (
            <span
              key={k}
              className={cx('g-pp-seg', k < done && 'g-pp-seg-done', k === index && 'g-pp-cur')}
              style={k === index && k >= done ? { '--fill': pct } : undefined}
            />
          ))}
        </span>
      )
    }
    const isDone = ph.state === 'done'
    return (
      <span key={i} className={cx('g-pp-pill', 'g-pp-' + ph.tone, isDone && 'g-pp-done')} title={ph.name}>
        {isDone ? <Icon name="check" className="g-icon" /> : (ph.countLabel ?? ph.count)}
      </span>
    )
  })
  return <Act href={href} onClick={onOpen} ariaLabel={label} className="g-pp">{kids}</Act>
}
