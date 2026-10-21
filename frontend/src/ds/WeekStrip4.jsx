import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// Last 4 weeks under the Week page (bundle.js `WeekStrip4`, boards Sh2Week, Sh2WeekPast): four
// glass cells, one a week, each its start date, a bar per planned workout lit for each one done,
// and "3 of 4". The week on screen (`active`, its index) gets a white edge and is marked current.
// weeks: [{ key, label, done, planned, href, onClick }]; a cell is a link or a button only with
// somewhere to go. Never more than four.
export default function WeekStrip4({ weeks, active }) {
  return (
    <div className="g-w4">
      {weeks.slice(0, 4).map((w, i) => {
        const on = active === i
        const spoken = t('Week of {0}', w.label) + ', ' + t('{0} of {1} workouts', w.done, w.planned)
        const kids = (
          <>
            <b aria-hidden="true">{w.label}</b>
            <span className="g-w4-bars" aria-hidden="true">
              {Array.from({ length: w.planned }, (_, k) => <i key={k} className={k < w.done ? 'on' : undefined} />)}
            </span>
            <span className="g-w4-n" aria-hidden="true">{t('{0} of {1}', w.done, w.planned)}</span>
          </>
        )
        const cls = cx('g-w4-cell g-glass', on && 'on')
        if (w.href) return <a key={w.key} href={w.href} onClick={w.onClick} className={cls} aria-label={spoken} aria-current={on ? 'page' : undefined}>{kids}</a>
        if (w.onClick) return <button key={w.key} type="button" onClick={w.onClick} className={cls} aria-label={spoken} aria-current={on ? 'page' : undefined}>{kids}</button>
        return <span key={w.key} className={cls} role="img" aria-label={spoken}>{kids}</span>
      })}
    </div>
  )
}
