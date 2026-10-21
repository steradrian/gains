// Loading a ready-made plan into the store, with Undo (PR02 T10.1, T10.2; owner question 6).
// The plan data and the draft-level load live in lib/starter.js, which the API also imports
// under plain node; this half needs the store, so it is its own module.
import { useStore } from '../store/useStore.js'
import { profileEquipment } from './equipment.js'
import { todayISO } from './format.js'
import { effectiveRoutineIds } from './history.js'
import { plusDays } from './missed-day.js'
import { scheduleModeOf } from './rotation.js'
import { applyStarterPlan, buildStarterPlan } from './starter.js'
import { markUndone, undoMarks } from './sync-merge.js'

// How far ahead "Your week starts {date}" looks: two weeks covers any weekly plan.
const STARTS_AHEAD = 14

/** The first day from `today` (included) on which `S` plans one of `ids`, or null. */
export function firstPlannedDay(S, ids, today = todayISO()) {
  for (let i = 0; i < STARTS_AHEAD; i++) {
    const iso = plusDays(today, i)
    if (effectiveRoutineIds(S, iso, today).some(id => ids.includes(id))) return iso
  }
  return null
}

/**
 * Loads `planId` (fitted to the equipment profile `fit`, or as written) into the store:
 * the whole weekly plan is replaced (lib/starter.js applyStarterPlan). Null for an unknown id,
 * and nothing changes.
 *
 * Returns `{ undo, startsOn, added, fit }`:
 *   undo()    puts the weekdays back and removes only the routines this load added; true when it
 *             did, false the second time. Days changed since (on any device) keep that change.
 *   startsOn  the first date from today the loaded plan schedules, or null in rotation mode
 *             (a live pass or Rotation chosen): the weekly plan is written, but the rotation keeps
 *             deciding the days until you switch to Fixed week, so there is no date to promise.
 *   added     the ids of the routines this load added (reused ones are not among them)
 *   fit       buildStarterPlan's fit report ({ swapped, dropped, swaps, drops }), null as written
 */
export function loadStarterPlanWithUndo(planId, { fit = null, today = todayISO() } = {}) {
  const plan = buildStarterPlan(planId, fit ? profileEquipment(fit) : undefined)
  if (!plan) return null
  const store = useStore.getState()
  const before = store.S
  let load = null
  store.update(s => { load = applyStarterPlan(s, plan) })
  const after = useStore.getState().S
  // The weekday stamps the load moved, for the Undo to mark as put back: a day another device
  // set after it saw the load then still wins over the Undo (lib/sync-merge.js undoMarks).
  const marks = undoMarks(before, after)
  let done = false
  const undo = () => {
    if (done) return false
    done = true
    useStore.getState().update(s => { load.undo(s); markUndone(s, marks) })
    return true
  }
  return {
    undo,
    startsOn: scheduleModeOf(after) === 'rotation' ? null : firstPlannedDay(after, load.ids, today),
    added: load.added,
    fit: plan.fit ?? null
  }
}
