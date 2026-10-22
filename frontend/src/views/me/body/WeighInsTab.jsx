import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import TrendChart from '../../../ds/TrendChart.jsx'
import WeighInRow from '../../../ds/WeighInRow.jsx'
import { fmtDate, fmtNum } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { rangeOptions } from '../../../lib/progress-range.js'
import { axisDates } from './body-data.js'

// The Weigh-ins tab of the Body page (boards Me2Body, Me2Deleted, Me2Empty): the trend card, the
// list for the range, the line about the ask before a workout. It draws what bodyOf (body-data.js)
// gives it and holds nothing; the page owns the range and opens the drawers.
export const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n))

// "81.4 kg today · −0.3 kg in 7 days", or "Nothing logged yet".
export function bodySub(data) {
  if (data.empty) return t('Nothing logged yet')
  const { latest, unit, weekChange } = data
  const weight = fmtNum(latest.w) + ' ' + unit
  const head = latest.today ? t('{0} today', weight) : t('{0} on {1}', weight, fmtDate(latest.d, true))
  return weekChange ? head + ' · ' + t('{0} in 7 days', signed(weekChange) + ' ' + unit) : head
}

function toTargetText({ toTarget, target, unit }) {
  if (!toTarget) return null
  if (toTarget.kind === 'reached') return t('Target reached')
  const amount = fmtNum(toTarget.amount) + ' ' + unit
  return t(toTarget.kind === 'lose' ? '{0} to lose to {1}' : '{0} to gain to {1}', amount, fmtNum(target))
}

// `waiting`: the days whose weigh-in the server has not got yet (shown only while offline).
// `asks`: whether Gains asks for a weigh-in before the first workout of the week (S.weighIn !== false).
export default function WeighInsTab({ data, range, onRange, waiting, asks, onLog, onOpen }) {
  const tip = t('Same time, before breakfast, gives the cleanest trend.')
  const note = asks ? t('Gains also asks for a weigh-in before your first workout of the week.') + ' ' + tip : tip

  if (data.empty) {
    return (
      <StageEmpty illustration="chart" card={false} title={t('No weigh-ins yet')}
        body={asks ? t('Log your weight to start the curve.') + ' ' + t('Gains also asks before your first workout of the week.') : t('Log your weight to start the curve.')}
        action={t('Log weight')} onClick={onLog} />
    )
  }

  const { latest, unit, periodChange, target, points, rows } = data
  const toTarget = toTargetText(data)
  return (
    <>
      <div className="bd-hero">
        <span className="bd-eyebrow">{t('Body weight')} · {fmtDate(latest.d, true)}</span>
        <span className="bd-big">{fmtNum(latest.w)}<small>{unit}</small></span>
        {(periodChange || toTarget) && (
          <span className="bd-lines">
            {!!periodChange && <span>{t('{0} this period', signed(periodChange) + ' ' + unit)}</span>}
            {toTarget && <span>{toTarget}</span>}
          </span>
        )}
      </div>
      <div className="bd-pad">
        <StageSegmented label={t('Weigh-in range')} value={range} onChange={onRange} options={rangeOptions()} />
      </div>
      {points.length > 0 && (
        <div className="bd-pad">
          <TrendChart
            points={points.map(p => ({ d: p.d, v: p.w }))}
            axis={axisDates(points).map(d => ({ d, text: fmtDate(d) }))}
            target={target ?? undefined} targetCaption={target ? t('Target {0}', fmtNum(target) + ' ' + unit) : undefined}
            pointLabels={points.map(p => fmtDate(p.d, true) + ': ' + fmtNum(p.w) + ' ' + unit)}
            unit={unit} label={t('Weight over time')} />
        </div>
      )}
      <StageSection title={t('Weigh-ins')} action={t('{0} shown', rows.length)} />
      <div className="bd-list">
        {rows.map(r => (
          <WeighInRow key={r.d}
            weight={fmtNum(r.w) + ' ' + unit}
            date={r.today ? fmtDate(r.d, true) + ' · ' + t('today') : fmtDate(r.d, true)}
            change={r.change ? signed(r.change) + ' ' + unit : undefined}
            waiting={waiting?.has(r.d) ? t('Waiting to sync') : undefined}
            onClick={() => onOpen(r)} />
        ))}
      </div>
      <StageNote>{note}</StageNote>
    </>
  )
}
