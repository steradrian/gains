import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtNum, fmtDate, isoOf } from '../lib/format.js'
import { bwSheet, goalSheet, weighInsSheet, bwDeltaColor } from '../sheets.jsx'
import LineChart from './LineChart.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const daysBefore = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }

// Body weight on Home: the weight as of the shown day, its 7-day trend and Log (for that day).
export default function WeightCard({ date }) {
  const S = useStore(s => s.S)
  const from = daysBefore(date, 6)
  const upTo = S.bodyweight.filter(b => b.d <= date)
  const bw = upTo.at(-1) || null
  const week = upTo.filter(b => b.d >= from)
  // The change across the week: its last weigh-in against the one at or before its start.
  const base = S.bodyweight.filter(b => b.d < from).at(-1) || (week.length > 1 ? week[0] : null)
  const delta = bw && base && base !== bw ? bw.w - base.w : null
  const points = week.map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const signed = delta == null ? '' : (delta > 0 ? '+' : '−') + fmtNum(Math.abs(delta)) + ' ' + S.unit
  return <div className="card">
    <div className="row between bw-head">
      <h2>{t('Body weight')}</h2>
      <div className="row">
        <Button size="sm" icon="target" className={S.targetW ? 'bw-goal-btn' : ''} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
        <Button size="sm" icon="plus" onClick={() => bwSheet({ date })}>{t('Log')}</Button>
      </div>
    </div>
    {bw ? <>
      <div className="row bw-now">
        <div className="big">{fmtNum(bw.w)} <span className="muted bw-unit">{S.unit}</span></div>
        {!!delta && <span className="small row bw-delta" style={{ color: bwDeltaColor(delta, bw.w) }} aria-label={t('{0} over 7 days', signed)}>
          <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} />{fmtNum(Math.abs(delta))}
          <span className="muted"> · {t('7 days')}</span>
        </span>}
        <span className="dim small bw-when">{fmtDate(bw.d, true)}</span>
      </div>
      {S.targetW && <div className="small row bw-goal">
        <Icon name="target" />
        <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
      </div>}
      {points.length > 1 && <div className="chart bw-chart"><LineChart points={points} h={90} unit={S.unit} goal={S.targetW} /></div>}
      <div className="row bw-all">
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
      </div>
    </> : <div className="muted small">{S.weighIn === false
      ? t('No weigh-ins yet. Log your weight to start the curve.')
      : t("No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).")}</div>}
  </div>
}
