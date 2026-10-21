// The numbers behind Train's rings and today card (PR02 T2.0) that no other module has yet: the
// longest run of training weeks, a week's volume, the volume pair as the ring writes it, and how
// long a routine usually takes.
import { fmtNum, isoOf, startOfWeek, weekKey, weekStartOf } from './format.js'
import { workoutDay, workoutDuration, workoutVolume } from './history.js'

const routineIdsOf = w => (Array.isArray(w?.routineIds) ? w.routineIds : (w?.routineId ? [w.routineId] : []))

/** The longest run of consecutive weeks (the profile's first weekday) with a workout in each:
 *  the best that streakWeeks (history.js) has ever been. 0 without workouts. */
export function bestStreakWeeks(S) {
  const ws = weekStartOf(S)
  const weeks = [...new Set((S.workouts || []).map(workoutDay).filter(Boolean).map(d => weekKey(d, ws)))].sort()
  let best = 0, run = 0, prev = null
  for (const wk of weeks) {
    const d = new Date(wk + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    run = prev === isoOf(d) ? run + 1 : 1
    best = Math.max(best, run)
    prev = wk
  }
  return best
}

/** The volume of the finished workouts in the week of `iso` (the profile's weeks), in its unit. */
export function weekVolume(S, iso) {
  const ws = weekStartOf(S)
  const key = isoOf(startOfWeek(iso, ws))
  return (S.workouts || []).reduce((v, w) => {
    const day = workoutDay(w)
    return day && weekKey(day, ws) === key ? v + workoutVolume(w) : v
  }, 0)
}

// PR02Graph, decided 19 Oct: kilograms, switching to tonnes above 10 000 kg.
export const TONNE_FROM = 10000

/** Two volumes in one unit, so they compare at a glance: tonnes for both when either is past
 *  TONNE_FROM kg, else the profile's unit (a pound profile always stays in pounds). */
export function volumePair(a, b, unit) {
  const tonnes = unit === 'kg' && Math.max(a, b) >= TONNE_FROM
  const show = v => fmtNum(tonnes ? Math.round(v / 100) / 10 : Math.round(v))
  return { a: show(a), b: show(b), unit: tonnes ? 't' : unit }
}

/** How long `routineId` usually takes: the median of its last five timed sessions (a minute or
 *  more), in ms; null when it has none. Untimed imports and sessions of other routines don't count. */
export function usualDuration(S, routineId, last = 5) {
  const times = (S.workouts || [])
    .filter(w => routineIdsOf(w).includes(routineId))
    .sort((x, y) => ((workoutDay(x) || '') < (workoutDay(y) || '') ? -1 : 1))
    .map(workoutDuration).filter(ms => ms >= 60000)
    .slice(-last).sort((x, y) => x - y)
  if (!times.length) return null
  const mid = times.length >> 1
  return times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2)
}
