// The Week page's data (PR07 D2.0, D2.1), pure: a week as the boards Sh2Week and Sh2WeekPast show
// it. useWeek (use-week.js) feeds it the store, the diary days and the clock. This week counts
// against the Plan as it is now, and a day moved shows on its new date (PR07Edges, D2); a past
// week is held to the plan only when the plan provably has not changed since (the notifications
// feed's planKnown), else it has no "of y" and no missed days. A week with nothing still has its
// cells and Last 4 weeks; every number it cannot back is null ("–"), never made up.
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { isoWeekOf, weekNumberOf, weekStartOfId } from '../../lib/day-route.js'
import { fmtDate, weekKey, weekStartOf } from '../../lib/format.js'
import { effectiveRoutineIds, workoutDay, workoutDuration, workoutVolume } from '../../lib/history.js'
import { plusDays, skippedOn } from '../../lib/missed-day.js'
import { levelsOf, loadOfWorkouts, untrainedRegions } from '../../lib/muscles.js'
import { planKnown } from '../../lib/notifications/feed.js'
import { totalsOf, waterTotal } from '../../lib/nutrition/diary.js'
import { pinState, queueOf, weekTally } from '../../lib/queue.js'
import { bestStreakWeeks, weekVolume } from '../../lib/train-stats.js'
import { trainingDay, workoutsByDay } from '../../lib/training-day.js'
import { regionList } from '../train/use-train.js'
import { missedPlanOf, ON_TARGET_KCAL } from './day-data.js'
import { dayTargetsOf, waterGoalSet } from './food-target.js'

const round = v => Math.round(Number(v) || 0)
const dateOf = iso => new Date(iso + 'T12:00:00')
const daysOf = start => Array.from({ length: 7 }, (_, k) => plusDays(start, k))
const inWeek = (S, start) => {
  const end = plusDays(start, 6)
  return (S.workouts || []).filter(w => { const d = workoutDay(w); return d && d >= start && d <= end })
}
const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)
const shortDay = iso => dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'short' })

/** "12 to 18 Oct", or "28 Sep to 4 Oct" across a month. */
export function rangeOf(start) {
  const end = plusDays(start, 6)
  const from = start.slice(0, 7) === end.slice(0, 7) ? String(dateOf(start).getDate()) : fmtDate(start)
  return t('{0} to {1}', from, fmtDate(end))
}

/** Workouts done of planned in the week starting `start`, one measure for every week (weekTally,
 *  as Today's line counts this week): this week up to today, a past week to its last day. A past
 *  week whose plan may have changed since (planKnown) has its workouts and `planned` null. */
export function weekCountOf(S, start, today) {
  if (weekKey(today, weekStartOf(S)) === start) return weekTally(S, today)
  const end = plusDays(start, 6)
  return planKnown(S, start, end) ? weekTally(S, end) : { done: inWeek(S, start).length, planned: null }
}

/** A day's training mark: 'done', a past day's 'missed' or 'skipped' (answered with Skip), today's
 *  or a later day's 'planned', else 'rest'. Nothing before the first workout counts as missed,
 *  nor anything in a week the plan cannot be held to (day-data.js missedPlanOf). */
export function workoutMarkOf(S, iso, today) {
  if (workoutsByDay(S.workouts || []).has(iso)) return 'done'
  if (iso >= today) return effectiveRoutineIds(S, iso, today).length ? 'planned' : 'rest'
  if (!missedPlanOf(S, iso, today)) return 'rest'
  return skippedOn(S, iso) ? 'skipped' : 'missed'
}

/**
 * One day's food, from the diary: `{ logged, kcal, target, band, protein, proteinTarget, waterMl }`,
 * or null with nutrition off, the day not loaded yet, or its target not ready (so a cell never
 * shows the fixed target and then jumps). `food` is `{ on, settings, entries, goalInputs,
 * activity, tried }`: `entries[iso]` the diary entry (null when loaded and empty, absent when not
 * loaded), `activity[iso]` the store's activity record, `tried[iso]` that the day's goal-input load
 * has finished. The target is food-target.js dayTargetsOf's, the Day page's own: null (and the
 * band with it) without a goal behind it.
 */
export function dayFoodOf(food, iso) {
  if (!food?.on || !food.settings || food.entries?.[iso] === undefined) return null
  const targets = dayTargetsOf({
    settings: food.settings, date: iso, goalInputs: food.goalInputs || {}, activity: food.activity?.[iso] || null, tried: !!food.tried?.[iso],
  })
  if (!targets.ready) return null
  const entry = food.entries[iso]
  const totals = totalsOf(entry?.items)
  const kcal = round(totals.calories)
  const diff = targets.kcal == null ? null : kcal - targets.kcal
  return {
    logged: (entry?.items || []).length > 0, kcal, target: targets.kcal,
    band: diff == null ? null : Math.abs(diff) <= ON_TARGET_KCAL ? 'on' : diff > 0 ? 'over' : 'under',
    protein: round(totals.proteins), proteinTarget: targets.macro('proteins'),
    waterMl: waterTotal(entry),
  }
}

// The volume lifted on the days `from` to `to`, both included.
const volumeBetween = (S, from, to) => (S.workouts || []).reduce((v, w) => {
  const d = workoutDay(w)
  return d && d >= from && d <= to ? v + workoutVolume(w) : v
}, 0)

/** Weeks in a row with a workout, up to the week starting `start` (this week may not have one
 *  yet: the run then counts from the week before, as streakWeeks does). */
export function streakAsOf(S, start, today) {
  const ws = weekStartOf(S)
  const weeks = new Set((S.workouts || []).map(workoutDay).filter(Boolean).map(d => weekKey(d, ws)))
  const current = weekKey(today, ws) === start
  let n = 0
  for (let k = 0, wk = start; k < 520; k++, wk = plusDays(wk, -7)) {
    if (weeks.has(wk)) n++
    else if (!(k === 0 && current)) break
  }
  return n
}

// The day after `after` that a Coach week pinned the missed routine to (lib/queue.js pinState), or
// null. Only a planner's queue (no rotationId) is Coach's; your own rotation is not.
function coachMovedTo(S, ids, after) {
  const q = queueOf(S)
  if (!q || q.rotationId) return null
  return Object.keys(S.dayPlan || {}).filter(d => d > after && ids.includes(S.dayPlan[d]) && pinState(S, S.dayPlan[d]) === 'open').sort()[0] || null
}

/**
 * The line under the body map, only from what happened: the parts not trained yet (this week),
 * or that every part was trained; then the last missed day, and where Coach moved it when Coach
 * did. null when there is nothing to say (a week with no workout and nothing missed).
 */
export function muscleNoteOf(S, { load, workouts, missed, current }) {
  const parts = []
  if (workouts.length) {
    const untrained = untrainedRegions(load)
    if (!untrained.length) parts.push(t('Every muscle group trained.'))
    else if (current) parts.push(t('{0} not trained yet', regionList(untrained)) + '.')
  }
  const last = missed.at(-1)
  if (last) {
    parts.push(t('{0} was missed on {1}.', last.name, shortDay(last.iso)))
    const to = coachMovedTo(S, last.ids, last.iso)
    if (to) parts.push(t('Coach moved it to {0}.', fmtDate(to, true)))
  }
  return parts.length ? parts.join(' ') : null
}

/**
 * Everything the Week page shows for the week named `isoWeek` (`2026-W42`), as data:
 *
 *   { isoWeek, start, end, current, range, status, ring, cells, muscles, muscleNote, numbers,
 *     last4, prev, next }
 *
 * `ring` is `{ done, planned, today, missed, skipped }`: `today` the routine still to do today
 * (this week only), `missed` and `skipped` the days, each `{ iso, day, name, ids }`. `cells` are 7
 * `{ iso, dow, date, today, future, workout, food }` (`workout` from workoutMarkOf, `food` from
 * dayFoodOf). `muscles` is `{ load, levels }` (sets per muscle, BodyMap's 0–4). `numbers` holds
 * `streak`, `onTarget`, `kcal`, `protein`, `weight`, `activity`, `volume` and `water`, each null
 * when the week cannot back it. Today is still being logged, so it stays out of every average
 * and of days on target; this week's volume is held to last week's same days so far
 * (`volume.sameDays`). `last4` are the four weeks up to this one (`{ isoWeek, start, label, done,
 * planned, current, selected }`), `prev` and `next` week names (`prev` null from the week of the
 * first log `first`, `next` null past this week). null for a name that is no week.
 */
export function weekOf({ S, isoWeek, today, food, first = null }) {
  const ws = weekStartOf(S)
  const start = weekStartOfId(isoWeek, ws)
  if (!start) return null
  const end = plusDays(start, 6)
  const thisStart = weekKey(today, ws)
  const current = start === thisStart
  const workouts = inWeek(S, start)

  const cells = daysOf(start).map(iso => ({
    iso, dow: dateOf(iso).toLocaleDateString(dateLocale(), { weekday: 'narrow' }), date: dateOf(iso).getDate(),
    today: iso === today, future: iso > today,
    workout: workoutMarkOf(S, iso, today),
    food: iso > today ? null : dayFoodOf(food, iso),
  }))
  const marked = mark => cells.filter(c => c.workout === mark).map(c => {
    const day = trainingDay(S, c.iso, today)
    return { iso: c.iso, day: shortDay(c.iso), name: day.name, ids: day.ids }
  })
  const missed = marked('missed'), skipped = marked('skipped')
  const todayDay = current ? trainingDay(S, today, today) : null
  const todays = todayDay?.kind === 'planned' ? todayDay : null

  const load = loadOfWorkouts(workouts)
  const count = weekCountOf(S, start, today)

  const closed = cells.filter(c => !c.today)
  const eaten = closed.map(c => c.food).filter(f => f?.logged)
  const judged = eaten.filter(f => f.target != null)
  const proteinTargets = eaten.map(f => f.proteinTarget)
  const weighIns = (S.bodyweight || []).filter(b => b?.d >= start && b.d <= end && Number(b.w) > 0).sort((a, b) => (a.d < b.d ? -1 : 1))
  const drank = closed.map(c => c.food?.waterMl).filter(ml => ml > 0)
  const volumeNow = weekVolume(S, start)
  const volumeLast = current ? volumeBetween(S, plusDays(start, -7), plusDays(today, -7)) : weekVolume(S, plusDays(start, -7))
  const streak = streakAsOf(S, start, today)
  const ms = workouts.reduce((n, w) => n + workoutDuration(w), 0)

  const numbers = {
    streak: streak > 0 ? { weeks: streak, best: current ? Math.max(bestStreakWeeks(S), streak) : null } : null,
    onTarget: judged.length ? { days: judged.filter(f => f.band === 'on').length, of: judged.length, within: ON_TARGET_KCAL } : null,
    kcal: eaten.length ? {
      avg: round(avg(eaten.map(f => f.kcal))),
      target: judged.length === eaten.length ? round(avg(judged.map(f => f.target))) : null,
    } : null,
    protein: eaten.length ? {
      avg: round(avg(eaten.map(f => f.protein))),
      target: proteinTargets.every(g => g != null) ? round(avg(proteinTargets)) : null,
    } : null,
    weight: weighIns.length >= 2 ? {
      from: Number(weighIns[0].w), to: Number(weighIns.at(-1).w), change: Number(weighIns.at(-1).w) - Number(weighIns[0].w), unit: S.unit,
    } : null,
    activity: workouts.length ? { ms: ms || null, count: workouts.length } : null,
    volume: volumeNow > 0 || volumeLast > 0 ? {
      now: round(volumeNow), last: round(volumeLast), unit: S.unit, sameDays: current, change: volumeLast > 0 ? (volumeNow - volumeLast) / volumeLast : null,
    } : null,
    water: drank.length && food?.settings ? { avgMl: round(avg(drank)), goalMl: waterGoalSet(food.settings) } : null,
  }

  const last4 = [-3, -2, -1, 0].map(k => {
    const from = plusDays(thisStart, k * 7)
    return { isoWeek: isoWeekOf(from, ws), start: from, label: fmtDate(from), ...weekCountOf(S, from, today), current: k === 0, selected: from === start }
  })

  const left = Math.round((dateOf(end) - dateOf(today)) / 864e5)
  return {
    isoWeek, start, end, current,
    range: rangeOf(start),
    status: current
      ? t('This week') + ' · ' + (left > 0 ? tn('{0} day to go', '{0} days to go', left) : t('Last day'))
      : t('Week {0} · complete', weekNumberOf(isoWeek)),
    ring: { done: count.done, planned: count.planned, today: todays?.name || null, missed, skipped },
    cells,
    muscles: { load, levels: levelsOf(load) },
    muscleNote: muscleNoteOf(S, { load, workouts, missed: [...missed, ...skipped].sort((a, b) => (a.iso < b.iso ? -1 : 1)), current }),
    numbers,
    last4,
    prev: first && start > weekKey(first, ws) ? isoWeekOf(plusDays(start, -7), ws) : null,
    next: current ? null : isoWeekOf(plusDays(start, 7), ws),
  }
}

/** A week's days with food to load: the week up to today. */
export const foodDaysOf = (start, today) => daysOf(start).filter(d => d <= today)
