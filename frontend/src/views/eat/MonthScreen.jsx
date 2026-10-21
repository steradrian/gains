import { dateLocale, t, tn } from '../../lib/i18n.js'
import { weekdayLetters } from '../../lib/nutrition/trends.js'
import MonthGrid from '../../ds/MonthGrid.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import './eat-history.css'

// Month on the stage (board Ea1Month), pushed from Eat: the month's grid with one ring per day, then
// "<Month> so far" with its tiles. It draws what monthOf (lib/nutrition/trends.js) gives it and
// holds nothing. A past day and today open (onDay; today opens Today), a day ahead stays dim and
// does nothing; a ring is on target (full), over (amber, no words) or under, and a day with
// nothing logged or no goal to hold it to has none. A tile no day backs is left out.
const whole = n => Math.round(n).toLocaleString(dateLocale())
const dateOf = iso => new Date(iso + 'T12:00:00')
const monthName = month => dateOf(month + '-01').toLocaleDateString(dateLocale(), { month: 'long' })
const monthYear = month => dateOf(month + '-01').toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })

// "13 and 9 Oct": the over days, newest first, when there are few enough to name.
function overDates(dates) {
  if (!dates.length || dates.length > 3) return undefined
  const days = new Intl.ListFormat(dateLocale(), { type: 'conjunction' }).format(dates.map(iso => String(Number(iso.slice(8)))))
  return `${days} ${dateOf(dates[0]).toLocaleDateString(dateLocale(), { month: 'short' })}`
}

// A day in words for a screen reader: "Monday 12 October, 1,980 of 2,100 kcal".
function cellLabel(c) {
  const words = [dateOf(c.iso).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })]
  if (c.open === 'today') words.unshift(t('Today'))
  if (c.open !== 'future' && !c.pending) {
    const f = c.figures
    words.push(!f?.logged ? t('No food logged')
      : f.target != null ? t('{0} of {1} kcal', whole(f.kcal), whole(f.target))
        : t('{0} kcal, no target', whole(f.kcal)))
  }
  return words.join(', ')
}

function tilesOf(tiles) {
  const out = []
  if (tiles.onTarget) out.push({ key: 'on', label: t('On target'), value: t('{0} of {1}', tiles.onTarget.days, tiles.onTarget.of), sub: t('days') })
  if (tiles.avg != null) out.push({ key: 'avg', label: t('Average'), value: whole(tiles.avg), sub: t('kcal a day') })
  if (tiles.over) out.push({ key: 'over', label: t('Over'), value: tn('{0} day', '{0} days', tiles.over.days), sub: overDates(tiles.over.dates) })
  return out
}

// `status`: 'ready', 'loading' (the grid without rings, no tiles) or 'error' (`errorText`, Retry).
export default function MonthScreen({ data, status = 'ready', errorText, today, weekStart, onPrev, onNext, onBack, onDay, onRetry }) {
  const current = today?.slice(0, 7) === data.month
  const items = status === 'ready' && data.ready ? tilesOf(data.tiles) : []
  const days = data.cells.map(c => ({
    day: c.day, iso: c.iso, value: status === 'ready' ? c.ring : null, label: cellLabel(c),
    onClick: c.open === 'day' || c.open === 'today' ? () => onDay(c.iso) : undefined,
  }))
  return (
    <StagePage title={monthName(data.month)} onBack={onBack} parent="/food">
      <div className="eh" aria-busy={status === 'loading' || undefined}>
        {status === 'error' ? (
          // TODO(empty-scenes): `chart` arrives with ds/empty-scenes.js
          <StageEmpty illustration="chart" title={errorText} action={t('Retry')} onClick={onRetry} />
        ) : (
          <>
            <div className="eh-pad">
              <MonthGrid
                days={days} title={monthYear(data.month)} offset={data.offset} today={current ? Number(today.slice(8)) : undefined}
                weekdays={weekdayLetters(weekStart, dateLocale())}
                legend={[{ label: t('On target'), value: 1 }, { label: t('Over'), value: 1.2 }, { label: t('Under'), value: 0.5 }]}
                onPrev={onPrev} onNext={onNext} prevLabel={t('Previous month')} nextLabel={t('Next month')}
              />
            </div>
            {items.length > 0 && (
              <>
                <StageSection title={current ? t('{0} so far', monthName(data.month)) : monthName(data.month)} />
                <div className="eh-pad"><StatTiles tone="stage" items={items} /></div>
              </>
            )}
            <StageNote>{t('A day opens its Day view. Today opens Today. Days ahead stay dim: food is never logged ahead.')}</StageNote>
          </>
        )}
      </div>
    </StagePage>
  )
}
