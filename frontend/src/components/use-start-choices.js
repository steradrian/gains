import { useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { effectiveRoutineIds, workoutDay } from '../lib/history.js'
import { missedDay } from '../lib/missed-day.js'
import { pinState } from '../lib/queue.js'
import { nameOf } from '../lib/training-day.js'

/**
 * What there is to start (the Start screen's chooser, `/train/workout`, and Train's Start a workout
 * drawer, PR02 T2.1), as data:
 *
 *   today:  { ids, routines, name, rescheduled }  today's planned session, started as one
 *   others: the other routines, in the routines' order
 *   missed: { iso, ids } | null                   the missed day Train names (lib/missed-day.js)
 *   last:   the latest workout logged, or null    for "Repeat a past workout"
 *
 * `rescheduled` is a day override that is not a fulfilled pin (a done coach session pinned here).
 */
export function startChoices(S, today = todayISO()) {
  const ids = effectiveRoutineIds(S, today, today)
  const routines = ids.map(id => S.routines.find(r => r.id === id)).filter(Boolean)
  const ovr = S.dayPlan?.[today]
  const rescheduled = ovr !== undefined && pinState(S, ovr) !== 'done'
  let last = null
  for (const w of S.workouts || []) { if (!last || (workoutDay(w) || '') >= (workoutDay(last) || '')) last = w }
  return {
    today: { ids, routines, name: nameOf(routines), rescheduled },
    others: S.routines.filter(r => !ids.includes(r.id)),
    missed: missedDay(S, today),
    last,
  }
}

export function useStartChoices() {
  const S = useStore(s => s.S)
  const today = todayISO()
  return useMemo(() => startChoices(S, today), [S, today])
}
