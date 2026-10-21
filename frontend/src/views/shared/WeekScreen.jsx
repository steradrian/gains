import { useRef } from 'react'
import Icon from '../../components/Icon.jsx'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { fmtDur, fmtNum, fmtVol } from '../../lib/format.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import Act from '../../ds/Act.jsx'
import BodyMap from '../../ds/BodyMap.jsx'
import StageNavBar from '../../ds/StageNavBar.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePageTitle from '../../ds/StagePageTitle.jsx'
import StageRing from '../../ds/StageRing.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageWeekCells from '../../ds/StageWeekCells.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import WeekStrip4 from '../../ds/WeekStrip4.jsx'
import './week.css'

// The Week page on the stage (boards Sh2Week, Sh2WeekPast), pushed under the tab it was opened
// from. It draws what useWeek() gives it (`week`) and holds nothing: the range and its status with
// ‹ › (no › past this week), the ring of workouts done of planned, the seven day cells, the muscle
// map shaded by sets, the Numbers, Last 4 weeks and the footer saying where a day goes. A number
// the week cannot back reads "–"; the food tiles show only with nutrition on. Every tap goes
// elsewhere. The range is the page's one h1 (StagePageTitle; the nav bar above it has none).
const DASH = '–'
const dateOf = iso => new Date(iso + 'T12:00:00')
const whole = n => Math.round(n).toLocaleString(dateLocale())
const grams = n => t('{0} g', whole(n))
const litres = ml => t('{0} L', (ml / 1000).toLocaleString(dateLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '')
const percent = v => sign(v) + Math.abs(v).toLocaleString(dateLocale(), { style: 'percent', maximumFractionDigits: 0 })
const dayAndDate = iso => dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' })

const MARK = {
  done: () => t('Workout done'),
  missed: () => t('Workout missed'),
  skipped: () => t('Workout skipped'),
  planned: () => t('Workout planned'),
  rest: () => t('Rest day'),
}

// The share of the target a cell's ring fills, or null when the cell shows "–" instead.
const ringOf = food => (food?.logged && food.target > 0 ? food.kcal / food.target : null)

// A cell in words, for a screen reader, saying what the cell shows: "Monday 12 October, Workout
// done, 1,980 of 2,100 kcal". A "–" says why: nothing logged, no target to hold it to, or a past
// day whose food has not loaded yet; a day to come says nothing about food.
function cellLabel(c, foodOn) {
  const words = [dateOf(c.iso).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })]
  if (c.today) words.unshift(t('Today'))
  words.push(MARK[c.workout]())
  if (foodOn && !c.future) {
    words.push(!c.food ? t('Food not loaded yet')
      : !c.food.logged ? t('No food logged')
        : ringOf(c.food) != null ? t('{0} of {1} kcal', whole(c.food.kcal), whole(c.food.target))
          : t('{0} kcal, no target', whole(c.food.kcal)))
  }
  return words.join(', ')
}

// What the ring says beside it: "workouts · Push A is today", or the week's one missed or
// skipped day, or how many there were.
function ringLine(ring) {
  const parts = [tn('workout', 'workouts', ring.planned || ring.done)]
  if (ring.today) parts.push(t('{0} is today', ring.today))
  else if (ring.missed.length === 1) parts.push(t('one missed on {0}', dayAndDate(ring.missed[0].iso)))
  else if (ring.missed.length > 1) parts.push(t('{0} missed', ring.missed.length))
  else if (ring.skipped.length === 1) parts.push(t('one skipped on {0}', dayAndDate(ring.skipped[0].iso)))
  else if (ring.skipped.length > 1) parts.push(t('{0} skipped', ring.skipped.length))
  return parts.join(' · ')
}

// The weight change as written: the sign only on a change that still shows once rounded, so a
// 0.02 kg drift reads "0 kg", never "+0 kg".
function weightChange(w) {
  const shown = fmtNum(Math.abs(w.change))
  return (shown === fmtNum(0) ? '' : sign(w.change)) + shown + ' ' + w.unit
}

// Numbers, in the boards' order; a tile the week cannot back is "–" with no line under it.
function numberTiles(n, { current, foodOn }) {
  const tile = (key, label, value, sub) => ({ key, label, value: value ?? DASH, sub: value == null ? undefined : sub })
  const { streak, onTarget, kcal, protein, weight, activity, volume, water } = n
  // This week's volume is held to last week's same days so far (volume.sameDays), a past week's
  // to the whole week before.
  const volumeSub = !volume ? undefined
    : volume.sameDays ? (volume.last > 0 ? t('{0} by this point last week', fmtVol(volume.last, volume.unit)) : undefined)
      : (volume.change != null ? t('{0} on the week before', percent(volume.change)) : undefined)
  return [
    tile('streak', t('Streak'), streak && tn('{0} week', '{0} weeks', streak.weeks),
      streak && [t('in a row'), streak.best != null ? t('best {0}', streak.best) : null].filter(Boolean).join(' · ')),
    foodOn && tile('onTarget', t('Days on target'), onTarget && t('{0} of {1}', onTarget.days, onTarget.of), onTarget && t('within {0} kcal', onTarget.within)),
    foodOn && tile('kcal', t('Average kcal'), kcal && whole(kcal.avg), kcal?.target != null ? t('of {0} a day', whole(kcal.target)) : undefined),
    foodOn && tile('protein', t('Average protein'), protein && grams(protein.avg), protein?.target != null ? t('of {0} a day', grams(protein.target)) : undefined),
    tile('weight', t('Weight'), weight && weightChange(weight),
      weight && `${fmtNum(weight.from)} → ${fmtVol(weight.to, weight.unit)}`),
    tile('activity', t('Activity'), activity && (activity.ms ? fmtDur(activity.ms) : tn('{0} workout', '{0} workouts', activity.count)),
      activity?.ms ? tn('{0} workout', '{0} workouts', activity.count) : undefined),
    tile('volume', t('Volume'), volume && fmtVol(volume.now, volume.unit), volumeSub),
    foodOn && tile('water', t('Water'), water && litres(water.avgMl), water && (water.goalMl ? t('a day · goal {0}', litres(water.goalMl)) : t('a day'))),
  ].filter(Boolean)
}

export default function WeekScreen({ week, onBack, onTrends }) {
  const accent = useDsAccent()
  const heading = useRef(null)
  const { ring, foodOn } = week
  // The heading takes focus only when the address really moved to another week.
  const go = id => {
    if (week.openWeek(id) === 'week') heading.current?.focus()
  }
  const days = week.cells.map(c => ({
    key: c.iso, dow: c.dow, date: c.date, training: c.workout, today: c.today,
    kcal: ringOf(c.food),
    over: c.food?.band === 'over',
    label: cellLabel(c, foodOn),
    onClick: c.open === 'before' ? undefined : () => week.openDay(c.iso),
  }))
  const weeks = week.last4.map(w => ({ key: w.isoWeek, label: w.label, done: w.done, planned: w.planned, onClick: () => go(w.isoWeek) }))

  return (
    <StageScreen accent={accent}>
      <div className="week">
        <StageNavBar onBack={onBack} />
        <div className="week-head">
          <StagePageTitle ref={heading} title={week.range} line={week.status} />
          {week.prev
            ? <Act onClick={() => go(week.prev)} ariaLabel={t('Previous week')} className="week-nav g-glass"><Icon name="chevronLeft" className="g-icon" /></Act>
            : <span className="week-nav week-nav-off" aria-hidden="true"><Icon name="chevronLeft" className="g-icon" /></span>}
          {week.next
            ? <Act onClick={() => go(week.next)} ariaLabel={t('Next week')} className="week-nav g-glass"><Icon name="chevronRight" className="g-icon" /></Act>
            : <span className="week-nav week-nav-off" aria-hidden="true"><Icon name="chevronRight" className="g-icon" /></span>}
        </div>

        <div className="week-ring">
          <span aria-hidden="true">
            <StageRing value={ring.done} max={ring.planned || ring.done || 1} size={112} stroke={11} />
          </span>
          <span className="week-ring-t">
            <b>{ring.done}{ring.planned > 0 && <span> {t('of {0}', ring.planned)}</span>}</b>
            <span>{ringLine(ring)}</span>
          </span>
        </div>

        <div className="week-pad week-cells">
          <StageWeekCells days={days} food={foodOn} label={week.range} />
        </div>

        <StageSection variant="label" title={t('Muscles this week')} />
        <div className="week-muscles g-glass">
          <div className="week-map"><BodyMap levels={week.muscles.levels} width={140} label={t('Sets per muscle this week')} /></div>
          <div className="week-scale" aria-hidden="true">
            {t('Less')}<i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" />{t('More')}
          </div>
          {week.muscleNote && <p>{week.muscleNote}</p>}
        </div>

        <StageSection variant="label" title={t('Numbers')} />
        <div className="week-pad">
          <StatTiles tone="stage" columns={2} items={numberTiles(week.numbers, { current: week.current, foodOn })} />
        </div>

        <StageSection variant="label" title={t('Last 4 weeks')} action={t('Trends')} onAction={onTrends} />
        <div className="week-pad">
          <WeekStrip4 weeks={weeks} active={week.last4.findIndex(w => w.selected)} />
        </div>

        <StageNote>{t('A past day opens its Day page, today opens Today, and a day to come opens its plan.')}</StageNote>
      </div>
    </StageScreen>
  )
}
