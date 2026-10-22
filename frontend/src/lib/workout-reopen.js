// Reopen (owner question 6, board W2.1 Saved): for 10 s after Done, the saved workout goes back to
// being the running session. The snapshot comes from the save (sheets/workout-flow.jsx
// finishAndSave) and lives in memory only:
//   { at, workoutId, active, exWeights: { <exId>: <value before> | null }, rotation: { queue, pins } | null }
// The record is taken out as History's delete takes one out (`s.workouts` without it, inside the
// store's update): stampDeletions records the removal in `S.deleted.workouts`, so a device that
// already pulled the saved workout drops it on its next merge. Finishing the reopened session
// later adds it back under the same id, which the stamp records as an add-back.
import { useStore } from '../store/useStore.js'
import { sameWorkout } from './workout-date.js'

export const REOPEN_MS = 10000

/** Whether `snapshot` can still reopen at `now`. */
export const canReopen = (snapshot, now = Date.now()) =>
  !!snapshot?.active && Number.isFinite(snapshot.at) && now - snapshot.at <= REOPEN_MS

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

/**
 * Puts `snapshot` back into the draft `s`: the session running again (its start, sets and `cur`),
 * the saved record gone, the confirmed weights and the rotation's refill as they were before the
 * save. Returns false, changing nothing, when something is running or the record is gone already.
 */
export function reopenInto(s, snapshot) {
  if (!snapshot?.active || s.active) return false
  const target = { id: snapshot.workoutId }
  if (!(s.workouts || []).some(w => sameWorkout(w, target))) return false
  s.workouts = s.workouts.filter(w => !sameWorkout(w, target))
  s.exWeights = s.exWeights || {}
  for (const [id, before] of Object.entries(snapshot.exWeights || {})) {
    if (before == null) delete s.exWeights[id]
    else s.exWeights[id] = clone(before)
  }
  if (snapshot.rotation) {
    s.queue = clone(snapshot.rotation.queue)
    if (Object.keys(snapshot.rotation.pins || {}).length) s.dayPlan = { ...(s.dayPlan || {}), ...snapshot.rotation.pins }
  }
  s.active = clone(snapshot.active)
  return true
}

/**
 * Reopen from the Saved toast. True when the session is running again; false when the 10 s are
 * over, a session is already running, or the record is gone. The rest timer is not restored.
 */
export function reopenWorkout(snapshot, now = Date.now()) {
  if (!canReopen(snapshot, now)) return false
  let done = false
  const st = useStore.getState()
  if (st.S.active || !(st.S.workouts || []).some(w => sameWorkout(w, { id: snapshot.workoutId }))) return false
  st.update(s => { done = reopenInto(s, snapshot) })
  return done
}
