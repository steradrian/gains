import { useEffect, useState } from 'react'
import { t, tn } from '../../lib/i18n.js'
import { fmtDate, fmtNum, durPart } from '../../lib/format.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { volumePair } from '../../lib/train-stats.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import DayFoodCard from '../../ds/DayFoodCard.jsx'
import DayStatusCard from '../../ds/DayStatusCard.jsx'
import GlassList from '../../ds/GlassList.jsx'
import StageDayRail from '../../ds/StageDayRail.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNavBar from '../../ds/StageNavBar.jsx'
import StagePageTitle from '../../ds/StagePageTitle.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import WorkoutCard from '../../ds/WorkoutCard.jsx'
import './day.css'

// A meal's glyph by its slot, as Today's meal tiles draw them (views/today/use-today.js).
const MEAL_ICONS = ['sunrise', 'sun', 'moon', 'apple']
const MACRO_NAME = { proteins: () => t('Protein'), carbohydrates: () => t('Carbs'), fat: () => t('Fat') }

// The Day page on the stage (boards Sh1Day, Sh1DayRest, Sh1DayMissed, Sh1DayEmpty, Sh1DayOff,
// Sh1Skipped), pushed under the tab it was opened from. It draws what useDay() gives it (`day`)
// and keeps only the rail's page: the nav bar (Back, and + for Add to this day), the rail of the
// day's week and the two before it, the date and its summary line (and `changed`, what changed
// for a notification whose target is gone), then Training, Food, and Water and body. A day with
// nothing logged has one line and the three ways to add to it instead. The date is the page's one
// h1 (StagePageTitle; the nav bar above it has none). `find` is the uuid of an entry a search's
// Day result opened the day for: its meal is highlighted and scrolled to once the food is in.
export default function DayScreen({ day, changed, find = null, onBack }) {
  const accent = useDsAccent()
  return (
    <StageScreen accent={accent}>
      <div className="day">
        <StageNavBar onBack={onBack} actions={[{ icon: 'plus', label: t('Add to this day'), onClick: day.add }]} />
        <Rail key={day.iso} rail={day.rail} iso={day.iso} onSelect={day.select} onWeek={day.openWeek} />
        <StagePageTitle title={day.title} line={day.summary || null} />
        {changed && <p className="day-changed" role="status">{changed}</p>}
        {day.state === 'empty'
          ? <Empty day={day} />
          : <>
            <StageSection variant="label" title={t('Training')} />
            <div className="day-gut"><Training day={day} /></div>
            <StageSection variant="label" title={t('Food')} />
            <div className="day-gut"><Food day={day} find={find} /></div>
            <Body day={day} />
          </>}
      </div>
    </StageScreen>
  )
}

// The day's week and the two before it. A day picked swaps the page in place (useDay's select
// replaces the address), so the rail is keyed by the day and opens on that day's week again; a
// swipe to an earlier week stays until then. The Week link opens the week on show.
function Rail({ rail, iso, onSelect, onWeek }) {
  const [shown, setShown] = useState(rail.index)
  const weeks = rail.weeks.map(w => w.days.map(d => ({ ...d, tag: '' })))
  return (
    <StageDayRail
      weeks={weeks}
      week={shown}
      home={rail.index}
      onWeek={setShown}
      title={rail.weeks[shown].title}
      action={t('Week')}
      onAction={() => onWeek(rail.weeks[shown].isoWeek)}
      selected={iso}
      onSelect={d => { if (d.iso !== iso) onSelect(d.iso) }}
      backLabel={rail.weeks[shown - 1]?.title}
      forwardLabel={rail.weeks[shown + 1]?.title}
    />
  )
}

const workoutMeta = w => [...durPart(w.durationMs), w.sets && tn('{0} set', '{0} sets', w.sets), w.start].filter(Boolean).join(' · ')

function workoutSummary(w) {
  const moved = w.volume ? volumePair(w.volume, w.volume, w.unit) : null
  return [w.sets && tn('{0} set', '{0} sets', w.sets), moved && t('{0} moved', moved.a + ' ' + moved.unit), ...durPart(w.durationMs)].filter(Boolean).join(' · ')
}

// What else the diary has for the day (a run from Health Connect); a logged workout's own
// estimate is the workout card already.
function Activities({ rows }) {
  const { energy } = useUnits()
  const list = rows.filter(r => r.source !== 'opengym')
  if (!list.length) return null
  return <GlassList items={list.map(r => ({ icon: 'figureRun', title: r.name + ' · ' + energy(r.kcal || 0) }))} />
}

function Training({ day }) {
  const planned = day.planned
  return (
    <div className="day-stack">
      {day.state === 'logged' && day.workouts.map(w => (
        <WorkoutCard key={w.id} name={w.name} meta={workoutMeta(w)} badge={w.bests > 0 ? tn('{0} new best', '{0} new bests', w.bests) : null}
          onClick={() => day.openWorkout(w)} levels={w.levels} muscles={w.muscles} summary={workoutSummary(w)}
          exercises={w.exercises.map(e => ({ name: e.name, sets: e.sets.join(' · '), image: e.image, newBest: e.best, onClick: () => day.openExercise(e) }))} />
      ))}
      {day.state === 'missed' && (
        <DayStatusCard tone="warn" icon="calendar" title={t('{0} was planned, not logged', planned.name)}
          body={t('Log it if you trained and forgot, or mark it skipped.')} thumbs={planned.routines.flatMap(r => r.images || [])}
          actions={[{ label: t('Add past workout'), solid: true, onClick: day.addPastWorkout }, { label: t('Mark skipped'), onClick: day.markSkipped }]} />
      )}
      {day.state === 'skipped' && (
        <DayStatusCard icon="skipForward" title={t('{0}, skipped', planned.name)} body={t('History still shows it as missed.')} tag={t('Skipped')} />
      )}
      {day.state === 'rest' && (
        <DayStatusCard icon="moon" title={t('Rest day')}
          body={day.next ? t('Nothing planned. {0} was next, {1}.', day.next.name, day.next.date) : day.planKnown ? t('Nothing planned.') : null}
          actions={[{ label: t('Add past workout'), onClick: day.addPastWorkout }]} />
      )}
      <Activities rows={day.activities} />
    </div>
  )
}

function Food({ day, find }) {
  const units = useUnits()
  const food = day.food
  const ready = food.tracking === 'on' && food.status === 'ready'
  const foundSlot = ready && find ? food.meals.find(m => m.items.some(i => i.uuid === find))?.slot ?? null : null
  // Once, when the found entry's meal is drawn: bring it into view (as the diary scrolled to it).
  useEffect(() => {
    if (foundSlot == null) return
    document.querySelector('.g-dfood-found')?.scrollIntoView?.({ block: 'center' })
  }, [foundSlot])
  if (food.tracking === 'off') {
    return <DayStatusCard tone="off" icon="utensils" title={t('Tracking off')} body={t('Sign in on the web app to log food and see your day here.')} />
  }
  if (food.status === 'loading') return <DayStatusCard icon="utensils" title={t('Loading…')} />
  if (food.status === 'error') {
    return <DayStatusCard icon="utensils" title={t('Could not load')} actions={[{ label: t('Retry'), onClick: food.retry }]} />
  }
  // Judged against the target only with a target behind it and something eaten: a day with
  // nothing logged is not "2,100 under target".
  const status = !food.logged || food.band == null ? null
    : food.band === 'on' ? t('On target')
      : food.band === 'over' ? t('{0} over target', units.energyValue(food.diff)) : t('{0} under target', units.energyValue(-food.diff))
  return (
    <DayFoodCard
      big={units.energyValue(food.kcal)}
      of={food.target != null ? t('of {0}', units.energy(food.target)) : null}
      status={status}
      progress={food.target > 0 ? food.kcal / food.target : 0}
      macros={food.macros.map(m => ({
        key: m.id, name: MACRO_NAME[m.id](),
        line: m.target != null ? t('{0} of {1} g', fmtNum(m.value), fmtNum(m.target)) : t('{0} g', fmtNum(m.value)),
        progress: m.target ? m.value / m.target : null,
      }))}
      meals={food.meals.map(m => ({
        key: m.slot, icon: MEAL_ICONS[m.slot] || 'utensils', name: m.name,
        sub: m.items.length ? m.items.map(i => i.name).filter(Boolean).join(', ') : t('Nothing logged'),
        value: m.items.length ? units.energyValue(m.kcal) : null, unit: units.energyUnit,
        found: m.slot === foundSlot,
        onClick: () => day.logFood(m.slot),
      }))}
    />
  )
}

// Water (with food tracking on: a tap adds a glass to the day), the weigh-in or a way to add one,
// and the latest measurements on or before the day.
function Body({ day }) {
  const units = useUnits()
  const rows = []
  if (day.water) {
    const w = day.water
    rows.push({
      icon: 'droplet', title: t('Water') + ' · ' + units.water(w.ml),
      sub: [tn('{0} glass', '{0} glasses', w.glasses), w.last && t('last at {0}', w.last)].filter(Boolean).join(', '),
      onClick: day.addWater || undefined,
    })
  } else if (day.addWater) {
    rows.push({ icon: 'droplet', title: t('Water'), sub: t('None logged'), onClick: day.addWater })
  }
  rows.push(day.weighIn
    ? { icon: 'scale', title: t('Weigh-in') + ' · ' + fmtNum(day.weighIn.w) + ' ' + day.weighIn.unit, onClick: day.weighInSheet }
    : { icon: 'scale', title: t('No weigh-in'), sub: t('Add one for this day'), onClick: day.weighInSheet })
  if (day.measurements) {
    const m = day.measurements
    const values = m.items.map(i => `${i.label} ${fmtNum(i.value)} ${i.unit}`).join(', ')
    rows.push({
      icon: 'ruler', title: t('Measurements'),
      sub: m.date === day.iso ? values : t('{0}, last on {1}', values, fmtDate(m.date, true)),
      onClick: day.openMeasurements,
    })
  }
  return <>
    <StageSection variant="label" title={t('Water and body')} />
    <div className="day-gut"><GlassList items={rows} /></div>
  </>
}

// D1.3, nothing logged: one line and the three ways to add to the day, the first naming it.
function Empty({ day }) {
  const food = day.food.tracking === 'on'
  const ways = [
    food && { label: t('Log food for {0}', day.title), onClick: () => day.logFood() },
    { label: t('Add past workout'), onClick: day.addPastWorkout },
    { label: t('Log weight'), onClick: day.weighInSheet },
  ].filter(Boolean)
  return (
    <StageEmpty card={false} illustration="calendar" title={t('Nothing logged')} body={t('Anything you add from here goes to {0}, not today.', day.title)}
      action={ways[0].label} onClick={ways[0].onClick} actions={ways.slice(1)} />
  )
}
