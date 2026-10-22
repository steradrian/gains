import { useState } from 'react'
import Button from '../../../ds/Button.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import TrendChart from '../../../ds/TrendChart.jsx'
import { fmtDate, fmtNum } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { rangeOptions } from '../../../lib/progress-range.js'
import { axisDates } from './body-data.js'
import { firstKey } from './measure-data.js'
import { signed } from './WeighInsTab.jsx'

// The Measurements tab of the Body page (board Me2Measure): the tracked measurements as chips, the
// picked one's latest value and change, its curve, then the latest of each. It draws what measureOf
// (measure-data.js) gives it and holds only which chip is picked; the page owns the range and opens
// the drawers.

// "84 cm" and the like.
const valueText = (v, unit) => fmtNum(v) + ' ' + unit
// A built-in measurement is named in the person's language; a custom one is their own word.
export const nameOf = field => (field.custom ? field.label : t(field.label))

// "5 tracked · last on Sat 17 Oct", or "Nothing tracked yet".
export function measureSub(data) {
  if (!data.count) return t('Nothing tracked yet')
  const tracked = t('{0} tracked', data.count)
  return data.lastDay ? tracked + ' · ' + t('last on {0}', fmtDate(data.lastDay, true)) : tracked
}

const changeText = (change, unit) => signed(change) + ' ' + unit + ' ' + t('since previous')

export default function MeasurementsTab({ data, range, onRange, onLog, onChoose }) {
  const [picked, setPicked] = useState(null)

  if (data.empty) {
    return data.count ? (
      <StageEmpty illustration="chart" card={false} title={t('No measurements yet')}
        body={t('Log your first measurements to start the curve.')}
        action={t('Log measurements')} onClick={onLog} />
    ) : (
      <StageEmpty illustration="chart" card={false} title={t('Nothing to chart yet')}
        body={t('Choose the measurements you want to track, then log your first check-in.')}
        action={t('Log measurements')} onClick={onLog} />
    )
  }

  const key = data.fields.some(f => f.key === picked) ? picked : firstKey(data)
  const field = data.fields.find(f => f.key === key)
  const { latest, change, since, points, unit } = field
  const name = nameOf(field)
  return (
    <>
      <div className="bd-pad">
        <ChipGroup tone="stage" scroll label={t('Measurement')} value={key} onChange={setPicked}
          options={data.fields.map(f => ({ value: f.key, label: nameOf(f) }))} />
      </div>
      <div className="bd-hero">
        <span className="bd-eyebrow">{latest ? name + ' · ' + fmtDate(latest.d, true) : name}</span>
        {latest
          ? <span className="bd-big">{fmtNum(latest.v)}<small>{unit}</small></span>
          : <span className="bd-lines"><span>{t('No measurements yet')}</span></span>}
        {latest && (change != null || since) && (
          <span className="bd-lines">
            {change != null && <span>{changeText(change, unit)}</span>}
            {since && <span>{t('{0} since {1}', signed(since.change) + ' ' + unit, fmtDate(since.d))}</span>}
          </span>
        )}
      </div>
      {latest && (
        <>
          <div className="bd-pad">
            <StageSegmented label={t('Measurement range')} value={range} onChange={onRange} options={rangeOptions()} />
          </div>
          {points.length > 0 && (
            <div className="bd-pad">
              <TrendChart
                points={points}
                axis={axisDates(points.map(p => ({ d: p.d }))).map(d => ({ d, text: fmtDate(d) }))}
                pointLabels={points.map(p => fmtDate(p.d, true) + ': ' + valueText(p.v, unit))}
                unit={unit} label={t('{0} over time', name)} />
            </div>
          )}
        </>
      )}
      <StageSection title={t('Latest')} action={t('Choose')} onAction={onChoose} />
      <div className="bd-pad">
        <div className="g-glist g-glass">
          {data.fields.map(f => (
            <GlassValueRow key={f.key} title={nameOf(f)} chevron={false} onClick={() => setPicked(f.key)}
              sub={f.latest ? fmtDate(f.latest.d, true) + (f.change != null ? ' · ' + changeText(f.change, f.unit) : '') : t('No measurements yet')}
              value={f.latest ? valueText(f.latest.v, f.unit) : undefined} />
          ))}
        </div>
      </div>
      <div className="bd-pad">
        <Button block onClick={onLog}>{t('Log measurements')}</Button>
      </div>
    </>
  )
}
