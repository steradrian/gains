import { dateLocale, t, tn } from '../../lib/i18n.js'
import { FOOD_RANGES, MIN_TREND_DAYS, hoursClock } from '../../lib/nutrition/trends.js'
import BarChart from '../../ds/BarChart.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageSegmented from '../../ds/StageSegmented.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import './eat-history.css'

// Food trends on the stage (boards Ea3Trends, Ea3Few), pushed from Eat. It draws what foodTrendsOf
// (lib/nutrition/trends.js) gives it and holds nothing: the range (7, 30 or 90 days, kept in the
// address by the page), the Average, On target and Protein tiles, the Calories chart against the
// target, the macros against theirs, the Fasting block (`fasting`, null leaves it out entirely) and
// the days, each opening its Day view. Under MIN_TREND_DAYS logged days it is Ea3Few instead.
// A tile or a bar no day backs is left out, never made up. Today is drawn but never averaged.
const whole = n => Math.round(n).toLocaleString(dateLocale())
const dateOf = iso => new Date(iso + 'T12:00:00')
const dayAndDate = iso => dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
const grams = n => t('{0} g', whole(n))
const BAND = { on: () => t('On target'), under: () => t('Under'), over: () => t('Over') }

// A bar's letter under it: the weekday for a day, the day of the month a week starts on.
const barLabel = bar => (bar.one
  ? dateOf(bar.from).toLocaleDateString(dateLocale(), { weekday: 'narrow' })
  : String(Number(bar.from.slice(8))))

// A bar in words for a screen reader: "Sat 17 Oct: 2,100 kcal", a week as its span and average.
function barSpoken(bar) {
  const when = bar.one ? dayAndDate(bar.from) : t('{0} to {1}', dateOf(bar.from).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }), dayAndDate(bar.to))
  if (bar.one && bar.open) return t('{0}: {1}, today is still open', when, t('{0} kcal', whole(bar.value)))
  if (!bar.value) return t('{0}: {1}', when, t('No food logged'))
  return bar.one ? t('{0}: {1}', when, t('{0} kcal', whole(bar.value))) : t('{0}: {1}', when, t('{0} kcal a day', whole(bar.value)))
}

function summaryTiles(data) {
  const out = [{ key: 'avg', label: t('Average'), value: whole(data.avg), sub: t('kcal a day') }]
  if (data.onTarget) out.push({ key: 'on', label: t('On target'), value: t('{0} of {1}', data.onTarget.days, data.onTarget.of), sub: t('days logged') })
  const p = data.protein
  if (p) out.push({ key: 'protein', label: t('Protein'), value: grams(p.avg), sub: p.target != null ? t('of {0} a day', grams(p.target)) : t('a day') })
  return out
}

const MACRO_NAME = { proteins: () => t('Protein'), carbohydrates: () => t('Carbs'), fat: () => t('Fat') }

function Chart({ data }) {
  const { bars, range } = data
  const notes = []
  if (data.targetLine != null) notes.push(t('The dashed line is your target, {0} kcal.', whole(data.targetLine)))
  else if (data.hasTargets) notes.push(t('The dashes mark each day’s target.'))
  if (range > 7) notes.push(t('Each bar is the daily average of a week.'))
  notes.push(t('Today is still open.'))
  return (
    <>
      <div className="eh-pad">
        <BarChart
          tone="stage" values={bars.map(b => b.value)} labels={bars.map(barLabel)} barLabels={bars.map(barSpoken)}
          highlight={range === 7 ? bars.length - 1 : undefined}
          target={data.targetLine ?? undefined} targets={data.targetLine == null && data.hasTargets ? bars.map(b => b.target) : undefined}
          label={t('Calories, last {0} days', range)}
        />
      </div>
      <p className="eh-note">{notes.join(' ')}</p>
    </>
  )
}

function Macros({ macros }) {
  return (
    <div className="eh-pad">
      <div className="eh-macros g-glass">
        {macros.map(m => (
          <div key={m.id} className="eh-macro">
            <div className="eh-macro-top">
              <b>{MACRO_NAME[m.id]()}</b>
              <span>{m.target != null ? t('{0} of {1} g', whole(m.avg), whole(m.target)) : grams(m.avg)}</span>
            </div>
            {m.target != null && <div className="eh-track" aria-hidden="true"><i style={{ '--p': Math.min(100, Math.round((m.avg / m.target) * 100)) }} /></div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Fasting({ fasting, onFasting }) {
  const tiles = [{ key: 'avg', label: t('Average'), value: hoursClock(fasting.avgHours), sub: t('hours a fast') }]
  if (fasting.streak > 0) tiles.push({ key: 'streak', label: t('Streak'), value: tn('{0} day', '{0} days', fasting.streak), sub: t('on goal') })
  tiles.push({ key: 'longest', label: t('Longest'), value: hoursClock(fasting.longestHours), sub: dayAndDate(fasting.longestDay) })
  return (
    <>
      <StageSection title={t('Fasting')} action={t('See all')} onAction={onFasting} />
      <div className="eh-pad"><StatTiles tone="stage" items={tiles} /></div>
    </>
  )
}

function Days({ rows, onDay }) {
  return (
    <>
      <StageSection title={t('Days')} />
      <div className="eh-pad">
        <div className="g-glist g-glass">
          {rows.map(f => (
            <GlassValueRow
              key={f.date} title={dayAndDate(f.date)}
              sub={f.protein > 0 ? t('{0} kcal · P {1} g', whole(f.kcal), whole(f.protein)) : t('{0} kcal', whole(f.kcal))}
              value={f.band ? BAND[f.band]() : undefined} onClick={() => onDay(f.date)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// Ea3Few: not enough logged days to say anything. `onLog` opens the food picker.
function Few({ count, onLog }) {
  const shown = Math.min(count, MIN_TREND_DAYS)
  return (
    <div className="eh-few">
      <StageEmpty
        card={false} illustration="chart" title={t('Trends need 3 days')}
        body={(
          <>
            {t('Log food on 3 days to see your averages and how often you hit your targets.')}
            <span className="eh-pills" role="img" aria-label={t('{0} of {1} so far.', shown, MIN_TREND_DAYS)}>
              {Array.from({ length: MIN_TREND_DAYS }, (_, i) => <i key={i} className={i < shown ? 'on' : undefined} />)}
            </span>
          </>
        )}
        action={t('Log food')} onClick={onLog}
      />
    </div>
  )
}

// `status`: 'ready', 'loading' (the range control only) or 'error' (`errorText`, Retry).
export default function TrendsScreen({ data, status = 'ready', errorText, fasting, onRange, onBack, onTargets, onFasting, onDay, onLog, onRetry }) {
  const ready = status === 'ready' && data.ready
  return (
    <StagePage title={t('Food trends')} onBack={onBack} parent="/food">
      <div className="eh" aria-busy={status === 'loading' || undefined}>
        <div className="eh-pad">
          <StageSegmented
            label={t('Range')} value={data.range} onChange={onRange}
            options={FOOD_RANGES.map(n => ({ value: n, label: tn('{0} day', '{0} days', n) }))}
          />
        </div>
        {status === 'error' && (
          <StageEmpty card={false} illustration="chart" title={errorText} action={t('Retry')} onClick={onRetry} />
        )}
        {status === 'ready' && !data.enough && <Few count={data.loggedCount} onLog={onLog} />}
        {ready && data.enough && (
          <>
            <div className="eh-gap" />
            <div className="eh-pad"><StatTiles tone="stage" items={summaryTiles(data)} /></div>
            <StageSection title={t('Calories')} action={t('Daily targets')} onAction={onTargets} />
            <Chart data={data} />
            {data.macros.length > 0 && (
              <>
                <StageSection title={t('Macros, daily average')} />
                <Macros macros={data.macros} />
              </>
            )}
            {fasting && <Fasting fasting={fasting} onFasting={onFasting} />}
            {data.rows.length > 0 && <Days rows={data.rows} onDay={onDay} />}
          </>
        )}
      </div>
    </StagePage>
  )
}
