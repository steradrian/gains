import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

// The week on the stage (board O2.8): a glass row of seven days, each its short name over a disc;
// a lit day's disc turns white with a dumbbell in it, one after another (`--k`). days: [{ key,
// label, lit }]. Decoration: the screen says the same days in words.
export default function StageWeekStrip({ days }) {
  let k = 0
  return (
    <div className="g-week g-glass" aria-hidden="true">
      {days.map(d => (
        <span key={d.key} className="g-week-d">
          {d.label}
          <span className={cx('g-week-disc', d.lit && 'on')} style={d.lit ? { '--k': k++ } : undefined}>
            {d.lit && <Icon name="dumbbell" className="g-icon" />}
          </span>
        </span>
      ))}
    </div>
  )
}
