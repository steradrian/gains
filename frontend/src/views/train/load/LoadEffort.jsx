import { useMemo, useState } from 'react'
import { fmtDate, fmtNum, isoOf } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { effortOf } from '../../../lib/history.js'
import { displayScale, effortHistogram, effortSummary, effortWeeks, HARD_RIR, MIN_RATED, scaleName, toScale } from '../../../lib/effort.js'
import { anchorsByWorkout, resolveSetRir } from '../../../lib/recovery.js'
import LineChart from '../../../ds/LineChart.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import { recoveryOpts } from './use-training-load.js'

/**
 * Effort (owner question 4: Training load's fourth segment, offered once there is effort to read):
 * how hard the training was, the half of the picture a volume map cannot show. Everything is
 * computed in RIR (lib/effort.js) and shown in the profile's scale. Every number says how much of
 * the training it speaks for: rating is optional, so a partly rated history is the normal case.
 * Thin ratings fall back to estimates (the precedence fatigue scoring uses), badged as such; a
 * well-rated window keeps its logged numbers.
 */
export default function LoadEffort({ S }) {
  const [win, setWin] = useState(90)
  const kind = displayScale(S)
  const hd = scaleName(kind)
  const logged = effortSummary(S, win)
  const blend = logged.rated < MIN_RATED
  const opts = useMemo(() => recoveryOpts(S), [S.unit, S.bodyweight])
  const anchors = useMemo(() => (blend ? anchorsByWorkout(S.workouts, opts) : new Map()), [blend, S.workouts, opts])
  const resolve = (s, w, e) => resolveSetRir(s, s, e, w, anchors.get(w), opts)
  const sum = blend ? effortSummary(S, win, resolve) : logged
  const weeks = blend ? effortWeeks(S, win, resolve) : effortWeeks(S, win)
  const hist = blend ? effortHistogram(S, win, resolve) : effortHistogram(S, win)
  const estimated = blend && sum.est > 0
  const maxBin = Math.max(1, ...hist.map(b => b.n))
  // Bins run hardest first in both scales: RIR 0 and RPE 10 are the same set.
  const binLabel = b => (kind === 'rpe' ? (b.tail ? '≤ 6' : String(10 - b.rir)) : (b.tail ? b.rir + '+' : String(b.rir)))
  // The week's set count rides along, because the pair is the reading: volume up with effort up is
  // fatigue piling up, volume up with effort flat is adaptation.
  const values = weeks.map(w => toScale(kind, w.rir))
  const pointLabels = weeks.map((w, i) => t('Week of {0}', fmtDate(isoOf(new Date(w.t)))) + ': ' + fmtNum(values[i]) + ' ' + hd + ' · ' + t('{0} sets', w.sets))

  return (
    <section className="g-load-card g-glass g-load-effort">
      <h2 className="g-load-h">{t('Effort')} <span>· {t('how close to failure')}{estimated ? ' · ' + t('estimated') : ''}</span></h2>
      <StageSegmented label={t('Period')} value={win} onChange={setWin}
        options={[{ value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 365, label: '1Y' }, { value: 0, label: t('All') }]} />
      {sum.rated === 0 && sum.est === 0 ? <StageEmpty illustration="chart" title={t('No rated sets in this period.')} card={false} /> : (
        <>
          <div className="g-load-effort-stats">
            <p><b>{sum.avg == null ? '–' : fmtNum(toScale(kind, sum.avg)) + ' ' + hd}</b><span>{t('average effort')}</span></p>
            <p><b>{sum.hardPct == null ? '–' : Math.round(sum.hardPct * 100) + '%'}</b><span>{t('at {0} {1} or harder', hd, fmtNum(toScale(kind, HARD_RIR)))}</span></p>
          </div>
          <p className="g-load-small">{estimated
            ? t('{0} rated · {1} estimated of {2} sets', sum.rated, sum.est, sum.done)
            : t('{0} of {1} finished sets rated', sum.rated, sum.done)}</p>
          {effortOf(S) === 'none' && <p className="g-load-small">{t('Effort per set is off. Turn it on in Settings → Workout to keep rating.')}</p>}
          {weeks.length > 1 && (
            <>
              <h3 className="g-load-h3">{t('Week by week')}</h3>
              <LineChart tone="stage" values={values} pointLabels={pointLabels} unit={hd} height={140} invert={kind === 'rir'} label={t('Week by week')} />
            </>
          )}
          <h3 className="g-load-h3">{t('Where the sets land')}</h3>
          {hist.map(b => (
            <div key={b.rir} className="g-load-bin">
              <span>{hd} {binLabel(b)}</span>
              <span className="g-load-bar"><i className={b.rir <= HARD_RIR ? 'hard' : undefined} style={{ width: Math.round(b.n / maxBin * 100) + '%' }} /></span>
              <span>{b.n ? b.n + ' · ' + Math.round(b.pct * 100) + '%' : '–'}</span>
            </div>
          ))}
          <p className="g-load-small">{t('Most working sets belong close to failure, not at it. Half at the floor and half at the top still average out to a healthy-looking middle.')}</p>
        </>
      )}
    </section>
  )
}
