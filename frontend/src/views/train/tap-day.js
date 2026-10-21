import { todayISO } from '../../lib/format.js'
import { workoutDay } from '../../lib/history.js'
import { openDay, workoutDetailSheet } from '../../sheets.jsx'

/**
 * A day tapped on History's month or the load page's heatmap. Today's one workout opens its detail
 * (the Day page is never today); every other day goes to openDay: its Day page from the first log
 * on (PR07 D1), the note's sheet for a day off with a note, the plan drawer for a day to come.
 */
export function tapDay(S, iso, today = todayISO()) {
  const on = (S.workouts || []).filter(w => workoutDay(w) === iso)
  if (iso === today && on.length === 1) workoutDetailSheet(on[0])
  else openDay(iso)
}

/** A workout tapped in History's list: a past one opens its day, where it is listed with the rest
 *  of that day; today's opens its detail. */
export function tapWorkout(w, today = todayISO()) {
  const day = workoutDay(w)
  if (day && day < today) openDay(day)
  else workoutDetailSheet(w)
}
