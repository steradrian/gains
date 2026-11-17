import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const TRAINING = ['done', 'missed', 'planned', 'skipped', 'rest']

// The Week page's seven day cells (bundle.js `StageWeekCells`, boards Sh2Week, Sh2WeekPast): the
// weekday, the date (today's lit white), the training mark (done a white disc with a check, missed
// an amber ring with an ×, planned a glass ring, skipped a glass disc with a skip glyph, rest a
// small dot) and a mini ring of kcal against the day's target, or "–" with nothing logged.
//
// days: [{ key, dow, date, training, kcal, over, today, label, href, onClick }]. `kcal` is the
// share of the target eaten (0–1 and past it) or null; `over` turns the arc amber. `label` is the
// day in words, built by the page through t() ("Monday 12 October, workout done, 1,980 of 2,100
// kcal"). A cell is a link or button only with somewhere to go. `food={false}` (nutrition off)
// leaves the kcal row and its key out; `legend={false}` hides the key altogether.
export default function StageWeekCells({ days, food = true, legend = true, label }) {
  return (
    <div className="g-swc g-glass" role="group" aria-label={label}>
      <div className="g-swc-grid">
        {days.map(d => {
          oneOf('StageWeekCells', 'training', d.training, TRAINING)
          const kids = (
            <>
              <span className="g-swc-dow" aria-hidden="true">{d.dow}</span>
              <span className={cx('g-swc-date', d.today && 'on')} aria-hidden="true">{d.date}</span>
              <Mark training={d.training} />
              {food && (d.kcal != null ? <MiniRing f={d.kcal} size={30} sw={4} over={d.over} /> : <span className="g-swc-none" aria-hidden="true">–</span>)}
            </>
          )
          return d.href || d.onClick
            ? <Act key={d.key} href={d.href} onClick={d.onClick} ariaLabel={d.label} className="g-swc-cell">{kids}</Act>
            : <span key={d.key} className="g-swc-cell g-swc-still" role="img" aria-label={d.label}>{kids}</span>
        })}
      </div>
      {legend && (
        <div className="g-swc-legend" aria-hidden="true">
          <span><i className="g-swc-k-done" />{t('Workout')}</span>
          <span><i className="g-swc-k-missed" />{t('Missed')}</span>
          {food && <span><MiniRing f={0.7} size={12} sw={2.5} />{t('kcal against target')}</span>}
        </div>
      )}
    </div>
  )
}

function Mark({ training }) {
  if (training === 'done') return <span className="g-swc-m g-swc-done" aria-hidden="true"><Icon name="check" className="g-icon" /></span>
  if (training === 'missed') return <span className="g-swc-m g-swc-missed" aria-hidden="true"><Icon name="xmark" className="g-icon" /></span>
  if (training === 'planned') return <span className="g-swc-m g-swc-planned" aria-hidden="true" />
  if (training === 'skipped') return <span className="g-swc-m g-swc-skipped" aria-hidden="true"><Icon name="skipForward" className="g-icon" /></span>
  return <span className="g-swc-m g-swc-rest" aria-hidden="true"><i /></span>
}

// The bundle's MiniRing: a track and, past zero, an arc of `f` (capped at a full turn).
function MiniRing({ f, size, sw, over }) {
  const r = (size - sw) / 2
  const C = 2 * Math.PI * r
  const c = size / 2
  return (
    <svg className="g-mring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="g-mring-track" cx={c} cy={c} r={r} strokeWidth={sw} />
      {f > 0 && <circle className={cx('g-mring-val', over && 'g-mring-over')} cx={c} cy={c} r={r} strokeWidth={sw}
        strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - Math.min(f, 1))).toFixed(1)} />}
    </svg>
  )
}
