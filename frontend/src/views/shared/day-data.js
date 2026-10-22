// The Day page's data (PR07 D1.0 to D1.4), pure: a past day as the boards Sh1Day, Sh1DayRest,
// Sh1DayMissed, Sh1DayEmpty and Sh1DayOff show it. useDay (use-day.js) feeds it the store, the
// diary day and the clock; every value comes from real data, and what is not there is null.
import { dateLocale, t } from '../../lib/i18n.js'
import { isoWeekOf } from '../../lib/day-route.js'
import { exOr } from '../../lib/exercises.js'
import { exerciseNameText, exCount, fmtDate, fmtDaysAgo, isoOf, startOfWeek, weekStartOf } from '../../lib/format.js'
import { effectiveRoutines, setLabel, setsDone, workoutDay, workoutDuration, workoutVolume } from '../../lib/history.js'
import { enabledMeasurementFields, measurementUnit, measurementValue, toMeasurementDisplay } from '../../lib/measurements.js'
import { firstWorkoutDay, plusDays, skippedOn } from '../../lib/missed-day.js'
import { levelsOf, loadOfWorkouts, MUSCLE_NAME, rankOf } from '../../lib/muscles.js'
import { planKnown } from '../../lib/notifications/feed.js'
import { mealItems, nutritionOf, totalsOf } from '../../lib/nutrition/diary.js'
import { mealLabels } from '../../lib/nutrition/meal-name.js'
import { speedUnitOf } from '../../lib/speed.js'
import { nameOf, trainingDay, workoutLabel } from '../../lib/training-day.js'
import { hasCompletedWork, isWarmupRow } from '../../lib/workout-model.js'
import { glassOf } from '../today/use-today.js'
import { finishedLine, pictureOf, railDay } from '../train/use-train.js'
import { ON_TARGET_KCAL, dayTargetsOf, waterGoalSet } from './food-target.js'

export { ON_TARGET_KCAL }
// The Day rail shows the day's week and the two before it (Sh1Day).
export const RAIL_WEEKS = 3
const MACROS = ['proteins', 'carbohydrates', 'fat']

const round = v => Math.round(Number(v) || 0)

/* ---------------------------------------------------------------- the rail -- */

/**
 * The Day rail: `{ weeks, index, week }`. `weeks` are the day's week (the profile's first weekday)
 * and the two before it, oldest first, each `{ isoWeek, start, title, days }`; a day is Train's
 * railDay plus `selected`, `today`, `future` and `disabled` (before the first log: dimmed, and it
 * cannot be opened). `index` is the day's week, `week` its ISO name (the rail's Week link).
 */
export function dayRailOf(S, iso, today, first) {
  const ws = weekStartOf(S)
  const start = isoOf(startOfWeek(iso, ws))
  const weeks = Array.from({ length: RAIL_WEEKS }, (_, k) => {
    const from = plusDays(start, (k - RAIL_WEEKS + 1) * 7)
    return {
      isoWeek: isoWeekOf(from, ws), start: from, title: t('Week of {0}', fmtDate(from)),
      days: Array.from({ length: 7 }, (_, d) => {
        const day = railDay(S, plusDays(from, d), today, first)
        return { ...day, selected: day.iso === iso, today: day.iso === today, future: day.iso > today, disabled: day.state === 'plain' }
      }),
    }
  })
  return { weeks, index: RAIL_WEEKS - 1, week: isoWeekOf(iso, ws) }
}

/* ------------------------------------------------------------- the training -- */

const startTime = w => (Number(w.start) > 0
  ? new Date(Number(w.start)).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  : null)

/**
 * A logged workout as the Day page shows it: `{ id, workout, name, line, start, durationMs, sets,
 * volume, unit, bests, muscles, load, levels, exercises }`. `exercises` are `{ id, name, sets,
 * best }` with each work set ticked off as a line ("80×6"), warm-ups left out; `best` when the
 * workout set a new best on it. The picture is drawn from the `id` (ds/WorkoutCard), so a custom
 * exercise shows its own. `muscles` names the three most worked ("Chest, shoulders,
 * triceps"), `load` is the sets per muscle and `levels` the BodyMap shade (0–4).
 */
export function workoutOf(S, w) {
  const bests = new Set(w.prs || [])
  const speed = speedUnitOf(S)
  const exercises = (w.entries || []).map(e => {
    const sets = (e.sets || []).filter(s => hasCompletedWork(s) && !isWarmupRow(s)).map(s => setLabel(e.id, s, e.target, speed))
    return { id: e.id, name: exerciseNameText(exOr(e.id)), sets, best: bests.has(e.id) }
  }).filter(e => e.sets.length)
  const load = loadOfWorkouts([w])
  const top = rankOf(load).worked.slice(0, 3)
  return {
    id: w.id, workout: w, name: workoutLabel(w), line: finishedLine(w, S.unit), start: startTime(w),
    durationMs: workoutDuration(w) || null, sets: setsDone(w) || null, volume: round(workoutVolume(w)) || null, unit: S.unit,
    bests: bests.size, muscles: top.length ? top.map(m => t(MUSCLE_NAME[m])).join(', ') : null, load, levels: levelsOf(load), exercises,
  }
}

/** Whether the plan the day's week is read against is provably the one it had then (the
 *  notifications feed's planKnown: no plan edit since the week began, every planned weekday
 *  stamped, no queue reaching into it). Otherwise the day is held to no plan. */
export function planKnownOn(S, iso) {
  const start = isoOf(startOfWeek(iso, weekStartOf(S)))
  return planKnown(S, start, plusDays(start, 6))
}

/** The plan a past day missed (trainingDay's 'past-missed'), or null. Nothing before the first
 *  workout counts as missed, as on Train (lib/missed-day.js), and nothing in a week whose plan
 *  may have changed since (planKnownOn): today's plan is no proof of that day's. */
export function missedPlanOf(S, iso, today) {
  const first = firstWorkoutDay(S)
  if (!first || iso < first || !planKnownOn(S, iso)) return null
  const day = trainingDay(S, iso, today)
  return day.kind === 'past-missed' ? day : null
}

/** What a missed day had planned: `{ ids, name, routines }`, each routine `{ id, name, sub,
 *  stills }`, `stills` the ids of its exercises, which the card draws the pictures of (a custom
 *  exercise shows its own). */
const plannedOf = day => ({
  ids: day.ids, name: day.name,
  routines: day.routines.map(r => ({ id: r.id, name: r.name, sub: exCount(r.ex?.length || 0), stills: (r.ex || []).map(cfg => cfg.id) })),
})

/** On a rest day, what the plan had next: `{ name, iso, date }` for the first of the seven days
 *  after `iso` with routines planned (Sh1DayRest: "Pull A was next, Wed 14 Oct"), or null. */
export function nextPlannedOf(S, iso) {
  for (let k = 1; k <= 7; k++) {
    const d = plusDays(iso, k)
    const routines = effectiveRoutines(S, d)
    if (routines.length) return { name: nameOf(routines), iso: d, date: fmtDate(d, true) }
  }
  return null
}

// Whether the weekly plan has any day to train, so a day without one is a rest day "in your Plan".
const hasPlan = S => Object.values(S.week || {}).some(ids => [].concat(ids || []).length > 0)

/* ----------------------------------------------------------------- the food -- */

/**
 * The day's food from useDiaryDay's answer: `{ tracking: 'off' }` with nutrition off, else
 * `{ tracking: 'on', status }`: 'loading', 'error' (with `retry`), or 'ready' with `kcal`,
 * `target`, `diff` (kcal less target), `band` ('on' within ON_TARGET_KCAL, 'under', 'over'),
 * `logged` (any item), `macros` (`{ id, value, target }`, grams) and `meals` (`{ slot, name,
 * kcal, items }`, each item `{ uuid, name, kcal }`). `targets` is food-target.js dayTargetsOf's:
 * without a goal behind it, `target`, `diff` and `band` (or a macro's target) are null.
 */
export function foodOf(diary, targets = dayTargetsOf({ settings: diary?.settings, date: null, tried: true })) {
  if (!diary?.on) return { tracking: 'off' }
  if (diary.status === 'error') return { tracking: 'on', status: 'error', retry: diary.reload }
  if (diary.status !== 'ready') return { tracking: 'on', status: 'loading' }
  const kcal = round(diary.totals.calories), target = targets.kcal
  const diff = target == null ? null : kcal - target
  return {
    tracking: 'on', status: 'ready', kcal, target, diff,
    band: diff == null ? null : Math.abs(diff) <= ON_TARGET_KCAL ? 'on' : diff > 0 ? 'over' : 'under',
    logged: (diary.entry?.items || []).length > 0,
    macros: MACROS.map(id => ({ id, value: round(diary.totals[id]), target: targets.macro(id) })),
    meals: mealLabels(diary.settings).map((name, slot) => {
      const items = mealItems(diary.entry, slot)
      return {
        slot, name, kcal: round(totalsOf(items).calories),
        items: items.map(i => ({ uuid: i.uuid, name: i.name || '', kcal: round(nutritionOf(i).calories) })),
      }
    }),
  }
}

/** The day's water: `{ ml, goalMl, glasses, glassMl, last }` (`last` the time of the last glass as
 *  logged, or null; `goalMl` null without a water goal set), or null with nutrition off, before
 *  the day loads, or with none logged. */
export function waterOf(diary) {
  if (!diary?.on || !diary.dayReady || !(diary.water?.total > 0)) return null
  const glass = glassOf(diary.settings, diary.water.goal)
  const logs = diary.entry?.water || []
  return {
    ml: diary.water.total, goalMl: waterGoalSet(diary.settings), glassMl: glass.ml,
    glasses: Math.round(diary.water.total / glass.ml), last: logs.at(-1)?.time || null,
  }
}

/* ----------------------------------------------------------------- the body -- */

/** The day's weigh-in, `{ w, unit }`, or null. */
export function weighInOf(S, iso) {
  const b = (S.bodyweight || []).find(x => x?.d === iso && Number(x.w) > 0)
  return b ? { w: Number(b.w), unit: S.unit } : null
}

/** The latest measurements on or before the day: `{ date, items }`, each item `{ key, label,
 *  value, unit }` in the person's units, for the fields switched on; null when there are none. */
export function measurementsOf(S, iso) {
  const fields = enabledMeasurementFields(S)
  const entries = (S.measurements || []).filter(m => m?.d && m.d <= iso).sort((a, b) => (a.d < b.d ? 1 : -1))
  for (const entry of entries) {
    const items = fields.map(f => {
      const raw = measurementValue(entry, f.key)
      if (raw == null) return null
      const percent = f.key === 'bodyFat'
      return { key: f.key, label: f.custom ? f.label : t(f.label), value: percent ? raw : toMeasurementDisplay(raw, S.unit), unit: percent ? '%' : measurementUnit(S.unit) }
    }).filter(Boolean)
    if (items.length) return { date: entry.d, items }
  }
  return null
}

/* ------------------------------------------------------------------ the day -- */

/**
 * The day's state: 'logged' (a workout), 'missed' (the plan had one, not logged), 'skipped' (a
 * missed day answered with Skip, lib/missed-day.js skippedOn; one moved to another day is still
 * missed), 'rest' (no workout planned, something else logged, or the food still loading) or
 * 'empty' (nothing at all: D1.3).
 */
export function dayStateOf(S, iso, today, { workouts, food, water, weighIn }) {
  if (workouts.length) return 'logged'
  if (missedPlanOf(S, iso, today)) return skippedOn(S, iso) ? 'skipped' : 'missed'
  const foodKnown = food.tracking === 'off' || food.status !== 'loading'
  const ate = food.status === 'ready' && food.logged
  return !foodKnown || ate || water || weighIn ? 'rest' : 'empty'
}

/** The line under the title: "Push A done · on target · 6 days ago", whichever parts the day has.
 *  `energy(kcal)` writes kcal in the person's unit. A day with nothing logged says it was a "Rest
 *  day in your Plan" only when the plan has training days and none on this one (`restInPlan`). */
export function summaryOf({ state, workouts, planned, food, ago, energy, restInPlan = false }) {
  const training = state === 'logged' ? t('{0} done', workouts.map(w => w.name).join(' + '))
    : state === 'missed' ? t('{0} missed', planned.name)
      : state === 'skipped' ? t('{0} skipped', planned.name)
        : state === 'rest' ? t('Rest day')
          : restInPlan ? t('Rest day in your Plan') : null
  const eaten = food.status === 'ready' && food.logged ? (food.band === 'on' ? t('on target') : energy(food.kcal)) : null
  return [training, eaten, ago].filter(Boolean).join(' · ')
}

/**
 * Everything the Day page shows for a past day `iso`, as data (no actions; useDay adds those):
 *
 *   { iso, title, ago, summary, state, rail, workouts, planned, next, food, water, weighIn,
 *     measurements, activities }
 *
 * `diary` is useDiaryDay(iso)'s answer, `goalInputs` and `activity` the nutrition store's (the
 * day's target comes from food-target.js dayTargetsOf, as on the Week page), `first` the first
 * log (lib/day-route.js firstLogDay), `energy(kcal)` the person's energy unit. `planned` is the
 * missed or skipped day's routines, else null; `next` is a rest day's next planned workout
 * (nextPlannedOf), else null. `planKnown` says whether the day's week can be held to the plan
 * (planKnownOn); without it nothing is missed and nothing is said about what was planned.
 * `activities` are the diary's activity rows for the day (empty when it shows none).
 */
export function dayOf({ S, iso, today, first, diary, goalInputs = {}, activity = null, energy = kcal => `${round(kcal)} kcal` }) {
  const workouts = (S.workouts || []).filter(w => workoutDay(w) === iso).map(w => workoutOf(S, w))
  const missed = workouts.length ? null : missedPlanOf(S, iso, today)
  const food = foodOf(diary, dayTargetsOf({ settings: diary?.settings, date: iso, goalInputs, activity, tried: true }))
  const water = waterOf(diary)
  const weighIn = weighInOf(S, iso)
  const state = dayStateOf(S, iso, today, { workouts, food, water, weighIn })
  const planned = missed ? plannedOf(missed) : null
  const ago = fmtDaysAgo(iso, today)
  const known = planKnownOn(S, iso)
  const restInPlan = known && state === 'empty' && hasPlan(S) && !effectiveRoutines(S, iso).length
  return {
    iso, title: fmtDate(iso, true), ago, state, planKnown: known,
    summary: summaryOf({ state, workouts, planned, food, ago, energy, restInPlan }),
    rail: dayRailOf(S, iso, today, first),
    workouts, planned, next: state === 'rest' && known ? nextPlannedOf(S, iso) : null, food, water, weighIn,
    measurements: measurementsOf(S, iso),
    activities: diary?.on ? diary.activityRows || [] : [],
  }
}

/* ------------------------------------------------------- add a past workout -- */

/**
 * D1.6's choices for the day: the planned routines first (one choice for a combined day), then
 * every other routine, then an empty workout. Each `{ key, name, sub, planned, routineIds }`.
 */
export function pastWorkoutChoicesOf(S, iso, today) {
  const planned = missedPlanOf(S, iso, today)?.routines || []
  const plannedIds = new Set(planned.map(r => r.id))
  const one = r => ({ key: r.id, name: r.name, sub: exCount(r.ex?.length || 0), planned: plannedIds.has(r.id), routineIds: [r.id] })
  return [
    ...(planned.length > 1
      ? [{ key: 'planned', name: nameOf(planned), sub: exCount(planned.reduce((n, r) => n + (r.ex?.length || 0), 0)), planned: true, routineIds: planned.map(r => r.id) }]
      : planned.map(one)),
    ...S.routines.filter(r => !(planned.length === 1 && plannedIds.has(r.id))).map(r => ({ ...one(r), planned: false })),
    { key: 'freestyle', name: t('Freestyle'), sub: t('Pick exercises as you go'), planned: false, routineIds: [] },
  ]
}
