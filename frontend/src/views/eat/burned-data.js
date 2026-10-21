import { fmtNum } from '../../lib/format.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { calorieTarget } from '../../lib/nutrition/diary.js'
import { dayTargetsOf } from '../shared/food-target.js'

// The Burned page's arithmetic (boards Ea7Burned, PR04Edges "A big burn day"), apart from the
// screen so it can be read and tested without one. Burned is shown next to what was eaten and is
// never added to the target by this page.

// NutriTrace's wearable sources, by the name their makers use.
const DEVICE = { garmin: 'Garmin', fitbit: 'Fitbit', withings: 'Withings', google_health: 'Google Health', health_connect: 'Health Connect', polar: 'Polar', oura: 'Oura' }
const deviceName = source => DEVICE[source] || String(source).replace(/_/g, ' ')

/** A row with no Burned number: a workout kept from before Burned was turned on. */
export const isNumberless = row => !(row.kcal > 0)

/** An activity row as the page reads it. `workout` is the hub's entry for a finished workout. */
export function rowOf(raw, date) {
  return {
    id: raw.id,
    date,
    name: raw.name,
    workout: raw.source === 'opengym',
    minutes: Number(raw.duration_min) > 0 ? Number(raw.duration_min) : null,
    distance: Number(raw.distance) > 0 ? Number(raw.distance) : null,
    kcal: Number(raw.kcal) > 0 ? Number(raw.kcal) : 0,
    coveredBy: raw.covered_by || null,
  }
}

/**
 * The week's Burned from the store's activity records (`activity[date] = { status, rows, sum }`)
 * for `days` (the week up to `today`):
 *   total      the days' effective active kcal as the target reads them (a wearable's total stands
 *              in for the workout estimate on a day it reports); the rows' own kcal when a day's
 *              sum is missing
 *   workouts, activities   rows that carry a number and count toward it
 *   groups     [{ id: 'today' | 'earlier', rows }], newest first, empty groups left out
 *   missing    rows with no number
 *   loaded     every day's record has landed (failed or not); failed: one of them failed
 */
export function burnedWeekOf({ days, today, activity }) {
  const rows = []
  let total = 0
  for (const date of days) {
    const rec = activity[date]
    if (!rec) continue
    const mine = (rec.rows || []).filter(r => !r.is_template && !r.deleted_at).map(r => rowOf(r, date))
    rows.push(...mine)
    total += rec.sum?.effective ?? mine.filter(r => !r.coveredBy).reduce((sum, r) => sum + r.kcal, 0)
  }
  rows.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
  const counted = rows.filter(r => r.kcal > 0 && !r.coveredBy)
  const groups = [
    { id: 'today', rows: rows.filter(r => r.date === today) },
    { id: 'earlier', rows: rows.filter(r => r.date !== today) },
  ].filter(g => g.rows.length)
  return {
    loaded: days.every(d => activity[d]),
    failed: days.some(d => activity[d]?.status === 'error'),
    total: Math.round(total),
    workouts: counted.filter(r => r.workout).length,
    activities: counted.filter(r => !r.workout).length,
    groups,
    missing: rows.filter(isNumberless),
  }
}

/** "from 2 workouts and 1 activity", or null when no row carries a number. */
export function sourcesLine({ workouts, activities }) {
  const parts = [
    workouts > 0 && tn('{0} workout', '{0} workouts', workouts),
    activities > 0 && tn('{0} activity', '{0} activities', activities),
  ].filter(Boolean)
  if (!parts.length) return null
  return t('Burned this week, from {0}', parts.length === 2 ? t('{0} and {1}', parts[0], parts[1]) : parts[0])
}

const dayText = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })

/** The line under a row's name: the day (past days only), what it was, how far, how long, where the number is from. */
export function rowLine(row, today) {
  return [
    row.date !== today && dayText(row.date),
    row.workout && t('Workout'),
    row.distance != null && t('{0} km', fmtNum(row.distance)),
    row.minutes != null && t('{0} min', row.minutes),
    row.workout && row.kcal > 0 && !row.coveredBy && t('from your sets'),
    row.coveredBy && t('Covered by {0}', deviceName(row.coveredBy)),
  ].filter(Boolean).join(' · ')
}

const GROUP_TITLE = { today: () => t('Today'), earlier: () => t('Earlier this week') }

/**
 * What BurnedScreen draws for a `week` (burnedWeekOf): the figure and its line (left out for a
 * week with no number), the rows for GlassValueRow, and one line per row that has no number.
 * `energy` formats kcal in the person's unit. A row with no number calls `onAdd(row)`; the others
 * `onOpen(row)`.
 */
export function viewOf({ week, today, settings, goalInputs, energy, onAdd, onOpen }) {
  const item = row => ({
    key: row.id,
    icon: row.workout ? 'dumbbell' : 'figureRun',
    title: row.name,
    sub: rowLine(row, today),
    value: energy(row.kcal),
    onClick: isNumberless(row) ? () => onAdd(row) : () => onOpen(row),
  })
  return {
    title: !week.failed && week.total > 0 ? energy(week.total) : null,
    sub: !week.failed && week.total > 0 ? sourcesLine(week) || t('Burned this week') : null,
    note: settings ? noteOf({ settings, today, goalInputs, energy }) : null,
    groups: week.groups.map(g => ({ id: g.id, title: GROUP_TITLE[g.id](), items: g.rows.map(item) })),
    missing: week.missing.map(r => ({ key: r.id, text: t('{0} has no Burned number: it was logged before Burned was turned on. Tap it to add one.', r.name) })),
    // A day that failed to read counts as 0 in the total and is missing from the rows: neither the
    // figure nor "nothing burned" is true of a partial week, so the screen asks for a retry.
    failed: week.failed,
    empty: week.loaded && !week.failed && !week.groups.length,
  }
}

/**
 * The note that says what Burned does to the target. Without a goal there is no figure to quote
 * (the diary's 2000 stand-in is never shown), and Adaptive's own wording appears only in Adaptive.
 * With "Adjust goal from activity" on and a fixed target, Burned does add to the day's target: the
 * note says so instead of the usual line. `energy` formats kcal in the person's unit.
 */
export function noteOf({ settings, today, goalInputs = {}, energy }) {
  const mode = settings?.calorieGoalMode || 'fixed'
  const { adjust, fromBurn } = calorieTarget({
    settings, date: today, caloriesOut: goalInputs[today] ?? null, adaptiveTdee: goalInputs.adaptive ?? null,
  })
  const lead = t('Burned is shown next to what you ate.')
  if (adjust && !fromBurn) {
    return { title: t('Counted in your target'), body: [lead, t('Adjust goal from activity is on, so each day’s target adds that day’s Burned.')].join(' ') }
  }
  const kcal = dayTargetsOf({ settings, date: today, goalInputs, activity: null, tried: true }).kcal
  return {
    title: t('Never added to your target'),
    body: [
      lead,
      kcal != null && t('Your target stays {0} a day.', energy(kcal)),
      mode === 'adaptive' && t('Adaptive targets already count your activity.'),
    ].filter(Boolean).join(' '),
  }
}
