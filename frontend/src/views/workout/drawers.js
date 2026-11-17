// The running workout's drawer openers (shared doc, "Opener and action names"). Each one works
// today on the sheets the old screen uses; drawers-M2 and drawers-M3 replace the bodies with the
// new drawers, and the screen only ever imports these names.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr } from '../../lib/exercises.js'
import { buildSets, freestyleConfig, defaultConfig, supersetUnits, modeOf, applyIntensifierPlan } from '../../lib/history.js'
import { exerciseNameText } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { exercisePicker, exConfigSheet, addRoutineToSessionSheet } from '../../sheets.jsx'
import { discardSheet } from './finish-drawers.js'
import { insertionIndexAfterCurrentUnit } from '../../lib/supersetFlow.js'
import { defaultIncrement, weightIncrement } from '../../lib/progression.js'
import { buildPlannedEntry, builtOutOfProgression } from '../../lib/session-start.js'
import { joinSessionNoProg } from '../../lib/session-noprog.js'
import { sessionHistory } from '../../lib/backfill.js'
import { dropGrid } from '../../lib/plates.js'
import { withMeaning, historyAs, dbLoadFor, ownedWeightsFor } from '../../lib/dumbbells.js'
import { partsOf } from '../../lib/workout-parts.js'
// Workout drawers-M2
import { openSetEdit, openHowTo, openPlates, openRestWheel, openExerciseRest, lastLine } from './exercise-drawers.jsx'
// Workout drawers-M3
import { openMap, openOptions } from './map-drawers.jsx'
import { removeActiveExercise, UNDO_MS } from './workout-actions.js'

const state = () => useStore.getState().S
const update = (fn, local) => useStore.getState().update(fn, local)

/** Set edit (W1.12): the set's fields, effort, warm-up, failure, drops, bursts, copy, note, Remove. */
export const setEditSheet = (idx, i) => openSetEdit(idx, i)

/** How to (W1.14, W1.33, W1.34, W1.43), with Swap as a step inside it (W1.15). */
export const howToSheet = idx => openHowTo(idx)

/** Plate loading (W1.25); an exercise that loads no plates opens Bar and loading. */
export const platesSheet = idx => openPlates(idx)

/** Time left on the rest (W1.4). */
export const restWheelSheet = () => openRestWheel()

/** An exercise's own rest, where 0:00 means the default applies. This session's, like
 * everything edited on the exercise from inside it; Update routine offers to keep it. */
export const exerciseRestSheet = idx => openExerciseRest(idx)

/** The map (W1.37, W1.45, W1.23): every exercise by phase, reorder, Make superset, Skip, Options. */
export const workoutMapSheet = () => openMap({ addExercise: part => addExerciseSheet(null, part) })

/** Takes the exercise added at `at` back out (the toast's Undo) and puts the pointer where it was. */
function undoAdded({ activeId, at, exId, prevCur }) {
  const A = state().active
  if (!A || A.id !== activeId) { useUI.getState().toast(t('Too late, that one’s gone')); return }
  const idx = A.entries[at]?.id === exId ? at : A.entries.findIndex(e => e.id === exId)
  if (idx < 0) return
  removeActiveExercise(idx)
  update(s => { if (s.active) s.active.cur = Math.max(0, Math.min(prevCur, s.active.entries.length - 1)) })
}

/**
 * Add exercise (W1.18). After `afterIdx` (null: after the current unit), into `part` when given
 * (the end of that part's run, so the parts stay in order). A freehand add inherits the current
 * unit's routine (`rid`) and its block's `noProg`; a session kept out as a whole takes it too.
 */
export function addExerciseSheet(afterIdx = null, part = null) {
  exercisePicker((ex, quick) => {
    const S = state()
    const A = S.active
    if (!A) return
    const curEntry = A.entries[A.cur]
    const curRid = curEntry?.rid
    const routine = curRid ? S.routines.find(r => r.id === curRid) : null
    const freestyle = !routine
    const noProg = !freestyle && builtOutOfProgression(curEntry, routine)
    // Freestyle shows the last target in the config sheet and carries its rows forward.
    const seed = freestyle ? freestyleConfig(sessionHistory(S), { id: ex.id, ...defaultConfig(ex.id) }) : null
    const into = part && part !== 'main' ? part : null
    const commit = cfg => {
      let added = null
      update(s => {
        if (!s.active) return
        const full = { ...cfg, id: ex.id }
        const past = sessionHistory(s)
        const built = freestyle
          ? { target: withMeaning(s, cfg, ex.id), plan: null, sets: applyIntensifierPlan(buildSets(historyAs(past, ex.id, dbLoadFor(s, full)), full, {
            step: modeOf(full) === 'reps' ? (ownedWeightsFor(s, full) || weightIncrement(full, s.unit)) : defaultIncrement(ex.id, s.unit), preferLast: true,
          }), full, dropGrid(s, full)) }
          : buildPlannedEntry(past, full, routine, { noProg })
        let insertAt = afterIdx != null
          ? Math.min(afterIdx + 1, s.active.entries.length)
          : insertionIndexAfterCurrentUnit(supersetUnits(s.active.entries), s.active.cur, s.active.entries.length)
        const runs = partsOf(s.active.entries)
        if (into) {
          const run = runs.find(p => p.part === into)
          insertAt = run ? run.to + 1 : into === 'warmup' ? 0 : s.active.entries.length
        } else {
          // A workout-part add stays between the warm-up and the cool-down, whichever part the
          // add was opened from: at the end of the workout run when the spot falls outside it.
          const main = runs.find(p => p.part === 'main')
          if (main) { if (insertAt < main.from || insertAt > main.to + 1) insertAt = main.to + 1 }
          else insertAt = runs.find(p => p.part === 'warmup')?.to + 1 || 0
        }
        const after = s.active.entries[insertAt - 1]
        const prevCur = s.active.cur
        s.active.entries.splice(insertAt, 0, joinSessionNoProg(s.active, { id: ex.id, ...built, ...(curRid ? { rid: curRid } : {}), ...(noProg ? { noProg: true } : {}), ...(into ? { part: into } : {}) }))
        s.active.cur = insertAt
        useUI.getState().shiftRestOwner(insertAt, 1)
        added = { activeId: s.active.id, at: insertAt, exId: ex.id, prevCur, after: after ? exerciseNameText(exOr(after.id)) : null, count: s.active.entries.length }
      })
      // W1.19: where it went, counting every exercise like the footer, and Undo for 8 s.
      if (added) {
        useUI.getState().toast(added.after
          ? t('Added {0} after {1} · {2} of {3}', exerciseNameText(ex), added.after, added.at + 1, added.count)
          : t('Added {0} · {1} of {2}', exerciseNameText(ex), added.at + 1, added.count), {
          action: t('Undo'), ms: UNDO_MS, onAction: () => undoAdded(added),
        })
      }
    }
    // The picker row's "+" adds at once with the config the sheet would have opened with.
    if (quick) commit(seed || defaultConfig(ex.id))
    else exConfigSheet(ex, null, commit, null, routine, seed, null, t('Add to this workout'))
  }, {
    routine: t('This workout'),
    workout: {
      sub: ex => (state().active?.entries.some(e => e.id === ex.id) ? t('In this workout · added') : lastLine(state(), ex.id)),
      onAddRoutine: state().active?.editingWorkoutId ? undefined : () => addRoutineToSessionSheet(),
    },
  })
}

/** Ending the session without saving it: Discard asks first, then Undo on Today (W1.46, W1.26). */
export const discardWorkoutConfirm = () => discardSheet()

/**
 * Workout options (W1.20), with Workout settings as a step (W1.21). `markAllDone` is the hook's
 * (it re-baselines the progress marks); without it the sets are ticked in the drawer.
 */
export const workoutOptionsSheet = ({ markAllDone } = {}) => openOptions({
  markAllDone, addExercise: part => addExerciseSheet(null, part),
})
