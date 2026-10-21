import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { exCount, routineCount } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { queueOf } from '../../lib/queue.js'
import { rotationIds, scheduleModeOf } from '../../lib/rotation.js'
import { workoutControls } from '../../lib/workout-controls.js'
import { starterPlanSheet, startFlow } from '../../sheets.jsx'
import { useStore } from '../../store/useStore.js'
import { addRoutine, deleteRoutineWithUndo, duplicateRoutine, routineDaysOf, weekdayShort } from './routine-actions.js'

// A row shows at most this many exercise pictures (board T4.0).
const THUMBS = 3

const routineIdsOf = w => (Array.isArray(w?.routineIds) ? w.routineIds : (w?.routineId ? [w.routineId] : []))

// The routines some saved workout was built from, a combined one's included.
const usedIds = S => new Set((S.workouts || []).flatMap(w => [...routineIdsOf(w), ...(w.entries || []).map(e => e?.rid).filter(Boolean)]))

// The loop counts only while the Plan runs as one (Train's own rule, use-train.js scheduledIds):
// a loop saved under a fixed week is kept for later and plans nothing.
const loopIds = S => new Set(scheduleModeOf(S) === 'rotation' ? [...(queueOf(S)?.ids ?? []), ...rotationIds(S)] : [])

/**
 * Where routine `id` is in the Plan, as T4.0's rows and the editor's header (T5.0) say it: its
 * weekdays ("Sun, Thu"), "in your loop" for one that is only in the loop, or null when it is not
 * in the Plan. `loop` is the loop's ids, for a caller that asks for every routine.
 */
export function planWhereOf(S, id, loop = loopIds(S)) {
  const days = routineDaysOf(S, id)
  if (days.length) return days.map(weekdayShort).join(', ')
  return loop.has(id) ? t('in your loop') : null
}

/**
 * T4.0's rows and groups, from the store's state `S`, each group in `S.routines` order:
 *
 *   { count, planned, sub, groups: [{ key, title, rows }], freestyle, empty }
 *
 * `all` is every row in `S.routines` order (the Reorder list). A row is `{ id, name, sub, stills,
 * empty, inPlan }`, `stills` the ids of its first exercises (each drawn by ExerciseStillImg, so a
 * custom exercise shows its own picture). "In your Plan" is a routine on a weekday
 * or, while the Plan runs as a loop, in it. Its line is "6 exercises · Sun, Thu", or "· in your
 * loop" for one that is only in the loop. Outside the Plan the line says where the routine came
 * from ("· imported from Upper Lower", plan M3's `importedFrom`; "· imported" when the file had
 * no name), or "· not done yet" when no saved workout used it. `imported` is the landing state a
 * plan import navigates with ({ ids, from }, T4.4): those routines come first, "Added from …",
 * each "· new", and leave the other groups.
 */
export function routinesOf(S, { imported = null } = {}) {
  const loop = loopIds(S)
  const used = usedIds(S)
  const fresh = new Set(Array.isArray(imported?.ids) ? imported.ids : [])
  const row = r => {
    const planned = planWhereOf(S, r.id, loop)
    const inPlan = planned != null
    const n = exCount(r.ex?.length || 0)
    const where = fresh.has(r.id) ? t('new')
      : planned != null ? planned
        : r.importedFrom ? t('imported from {0}', r.importedFrom)
          : 'importedFrom' in r ? t('imported')
            : !used.has(r.id) ? t('not done yet') : ''
    return {
      id: r.id, name: r.name, inPlan, empty: !r.ex?.length,
      sub: [n, where].filter(Boolean).join(' · '),
      stills: (r.ex || []).slice(0, THUMBS).map(cfg => cfg.id),
    }
  }
  const rows = S.routines.map(row)
  const added = rows.filter(r => fresh.has(r.id))
  const rest = rows.filter(r => !fresh.has(r.id))
  const groups = [
    added.length && { key: 'added', title: imported?.from ? t('Added from {0}', imported.from) : t('Just added'), rows: added },
    { key: 'plan', title: t('In your Plan'), rows: rest.filter(r => r.inPlan) },
    { key: 'other', title: t('Not in your Plan'), rows: rest.filter(r => !r.inPlan) },
  ].filter(g => g && g.rows.length)
  const planned = rows.filter(r => r.inPlan).length
  return {
    all: rows,
    count: rows.length,
    planned,
    sub: rows.length ? routineCount(rows.length) + ' · ' + t('{0} in your Plan', planned) : null,
    groups,
    freestyle: { title: t('No routine'), name: t('Freestyle'), sub: t('Start a workout and pick exercises as you go') },
    empty: !rows.length,
  }
}

/**
 * Everything T4.0 shows and does: `routinesOf`'s data, plus `swipe` (Settings › Swipe actions),
 * `open(id)` (the editor), `startFreestyle()` (back to a running workout, else a freestyle start),
 * `move(from, to)` (reorders `S.routines`, which every screen reads, #142), `add()`, `plans()`,
 * `remove(id)` (T4.3, with Undo) and `duplicate(id)` (the copy, or null).
 */
export function useRoutines() {
  const S = useStore(s => s.S)
  const nav = useNavigate()
  const { state } = useLocation()
  const imported = state?.imported ?? null
  const data = useMemo(() => routinesOf(S, { imported }), [S, imported])
  return {
    ...data,
    swipe: workoutControls(S).swipeSets,
    open: id => nav('/train/routines/' + id),
    startFreestyle: () => (S.active ? nav('/train/workout') : startFlow([])),
    move: (from, to) => useStore.getState().update(s => {
      if (to < 0 || to >= s.routines.length) return
      const [m] = s.routines.splice(from, 1)
      s.routines.splice(to, 0, m)
    }),
    add: () => addRoutine(),
    plans: () => starterPlanSheet(),
    remove: deleteRoutineWithUndo,
    duplicate: id => duplicateRoutine(id),
  }
}
