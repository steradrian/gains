import { Fragment } from 'react'
import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'

const MARK = { done: 'check', missed: 'xmark', noted: 'note' }

// The Plan page's two weeks (board Tr3Plan; the bundle's StageWeekCells is one week of kcal rings,
// so this is drawn from the board): the weekday letters, then each week's title and its seven days,
// a tappable cell each with the date and what the day holds. `weeks` are `[{ title, days }]`, a
// day `{ iso, date, state, short, label, today }`, `state` one of 'done', 'missed', 'planned',
// 'rest', 'noted'. `dows` are the column letters. Every spoken word comes from the caller: `label`
// is the cell's name ("Thu 22 Oct, Push A"). The grid runs in the page's direction.
export default function PlanWeekGrid({ weeks = [], dows = [], onPick }) {
  return (
    <div className="g-pgrid g-glass">
      <div className="g-pgrid-grid">
        {dows.map((d, i) => <span key={'h' + i} className="g-pgrid-dow" aria-hidden="true">{d}</span>)}
        {weeks.map(w => (
          <Fragment key={w.title}>
            <h2 className="g-pgrid-week">{w.title}</h2>
            {w.days.map(d => (
              <button key={d.iso} type="button" data-iso={d.iso} aria-label={d.label} onClick={() => onPick?.(d.iso)}
                className={cx('g-pcell', 'g-pcell-' + d.state, d.today && 'today')}>
                <b>{d.date}</b>
                <span className="g-pcell-tag">
                  {MARK[d.state] && <Icon name={MARK[d.state]} className="g-icon" />}
                  <span>{d.short}</span>
                </span>
              </button>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
