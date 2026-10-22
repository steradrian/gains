// Journal kind `routine-delete`: a routine deleted from Plan's swipe or the routine menu
// (views/routines/routine-actions.js deleteRoutineWithUndo, which keeps its own 8 s Undo).
//
//   snapshot: routineSnapshot(S, id) of lib/routines.js, plus `marks` (undoMarks) —
//             { routine, index, week, dayPlan, seqAt, queueAt, marks }
//   subject:  the routine's name        facts: { exercises: n }
//
// Restore puts the routine back under the same id with restoreRoutine, the Undo's own mechanism:
// the store sees a routine whose removal is on record come back, stamps it as added back after the
// removal (stampDeletions), so a device that already took the removal brings it back on its next
// merge. Its places on the week, reschedules and loop go back where they are still free.
import { restoreRoutine, deleteRoutine } from '../routines.js'
import { markUndone } from '../sync-merge.js'
import { registerRestorer, recordChange } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'

export const ROUTINE_DELETE = 'routine-delete'

/** Journals a routine delete from the snapshot the delete took (routineSnapshot, with `marks`). */
export function recordRoutineDelete(snap) {
  if (!snap?.routine) return null
  return recordChange({
    kind: ROUTINE_DELETE, subject: snap.routine.name || '',
    facts: { exercises: Array.isArray(snap.routine.ex) ? snap.routine.ex.length : 0 },
    snapshot: snap,
  })
}

const routineIdOf = snap => snap?.routine?.id

export function restoreRoutineChange(snap) {
  const id = routineIdOf(snap)
  if (id == null) return { ok: false, reason: 'gone' }
  const st = useStore.getState()
  if ((st.S.routines || []).some(r => r.id === id)) return { ok: false, reason: 'replaced' }
  let ok = false
  st.update(s => {
    // Days of the week have been planned again in the meantime: only an empty one takes it back.
    const week = Object.fromEntries(Object.entries(snap.week || {}).filter(([d]) => [].concat(s.week?.[d] ?? []).length === 0))
    ok = restoreRoutine(s, { ...snap, week })
    if (ok && snap.marks) markUndone(s, snap.marks)
  })
  return ok ? { ok: true, where: { routineId: id } } : { ok: false, reason: 'replaced' }
}

/** Takes the restored routine away again, with the places the restore gave it. */
export function undoRoutineRestore(snap) {
  const id = routineIdOf(snap)
  const st = useStore.getState()
  if (id == null || !(st.S.routines || []).some(r => r.id === id)) return { ok: false, reason: 'gone' }
  st.update(s => { deleteRoutine(s, id) })
  return { ok: true }
}

registerRestorer(ROUTINE_DELETE, { restore: restoreRoutineChange, undo: undoRoutineRestore })
