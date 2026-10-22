// Journal kind `workout-delete`: a saved workout deleted from its detail sheet
// (sheets/workout-detail.jsx deleteWorkoutWithUndo, which keeps its own 8 s Undo).
//
//   snapshot: takeWorkout's answer, { taken: [{ index, rec }] }, plus the kept working weights of
//             the exercises the workout had (`exWeights: { <exId>: <value> }`, as workout-reopen.js
//             keeps them) and `marks` (undoMarks)
//   subject:  the workout's name ('' when it has none)     facts: { day, sets }
//
// Restore puts the record back at its place with putBackWorkout, the Undo's own mechanism: the
// store stamps it as added back after the removal, so a device that already took the removal
// brings it back on its next merge. The kept weights are written back only where nothing has
// been confirmed since (the way the reopen puts them back, but never over a newer value).
//
// A workout's photos and videos outlive the 8 s hold of the in-place Undo: the entry records their
// hashes (`media`), and the local media clean-up (media-sync.js localMediaGc) keeps every hash of a
// live entry until the entry is pruned (7 days) or cleared.
import { putBackWorkout, takeWorkout, takenMediaHashes } from '../workout-delete.js'
import { markUndone } from '../sync-merge.js'
import { workoutDay } from '../history.js'
import { sameWorkout } from '../workout-date.js'
import { registerRestorer, recordChange } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'

export const WORKOUT_DELETE = 'workout-delete'

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const setsOf = rec => (rec?.entries || []).reduce((n, e) => n + (Array.isArray(e?.sets) ? e.sets.length : 0), 0)

/**
 * Journals a workout delete. `snap` is takeWorkout's answer, `before` the state just before it
 * (for the kept weights), `marks` undoMarks(before, after).
 */
export function recordWorkoutDelete(snap, before, marks) {
  const rec = snap?.taken?.[0]?.rec
  if (!rec) return null
  const exWeights = {}
  for (const e of rec.entries || []) {
    if (e?.id != null && before?.exWeights?.[e.id] != null) exWeights[e.id] = clone(before.exWeights[e.id])
  }
  return recordChange({
    kind: WORKOUT_DELETE, day: workoutDay(rec) || undefined, subject: rec.name || '',
    facts: { day: workoutDay(rec) || '', sets: setsOf(rec) },
    snapshot: { taken: snap.taken, exWeights, marks: marks || null },
    media: takenMediaHashes(snap),
  })
}

/** Journals the delete of record `rec`, found in the state `S` just before the editor's "delete this workout". */
export function recordEditedWorkoutDelete(S, rec) {
  const index = (S?.workouts || []).findIndex(x => sameWorkout(x, rec))
  return index < 0 ? null : recordWorkoutDelete({ taken: [{ index, rec }] }, S, null)
}

export function restoreWorkoutChange(snap) {
  const taken = snap?.taken
  if (!Array.isArray(taken) || !taken.length) return { ok: false, reason: 'gone' }
  const st = useStore.getState()
  if (taken.every(({ rec }) => (st.S.workouts || []).some(x => sameWorkout(x, rec)))) return { ok: false, reason: 'replaced' }
  let ok = false
  st.update(s => {
    ok = putBackWorkout(s, snap)
    if (!ok) return
    if (snap.marks) markUndone(s, snap.marks)
    s.exWeights = s.exWeights || {}
    for (const [id, value] of Object.entries(snap.exWeights || {})) if (s.exWeights[id] == null) s.exWeights[id] = clone(value)
  })
  return ok ? { ok: true, where: { day: workoutDay(taken[0].rec) || '' } } : { ok: false, reason: 'replaced' }
}

/** Takes the restored workout out again. */
export function undoWorkoutRestore(snap) {
  const taken = snap?.taken
  if (!Array.isArray(taken) || !taken.length) return { ok: false, reason: 'gone' }
  let out = false
  useStore.getState().update(s => { for (const { rec } of taken) out = !!takeWorkout(s, rec) || out })
  return out ? { ok: true } : { ok: false, reason: 'gone' }
}

registerRestorer(WORKOUT_DELETE, { restore: restoreWorkoutChange, undo: undoWorkoutRestore })
