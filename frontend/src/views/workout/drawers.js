// The running workout's drawer openers (shared doc, "Opener and action names"). Each one works
// today on the sheets the old screen uses; drawers-M2 and drawers-M3 replace the bodies with the
// new drawers, and the screen only ever imports these names.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr } from '../../lib/exercises.js'
import { buildSets, freestyleConfig, defaultConfig, supersetUnits, modeOf, isPerSide, canBeWarmup, setSpanAt, setLabel, applyIntensifierPlan } from '../../lib/history.js'
import { exerciseNameText } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { back } from '../../lib/use-tab-nav.js'
import { durationSheet } from '../../components/DurationWheel.jsx'
import { adjustRestSheet } from '../../components/RestTimer.jsx'
import { workoutSettingsSheet } from '../../components/WorkoutSettingsSheet.jsx'
import { REST_MAX, fmtRest } from '../../lib/duration.js'
import { menuSheet, confirmSheet, exerciseDetailSheet, barWeightSheet, exercisePicker, exConfigSheet, workoutCompleteSheet, addRoutineToSessionSheet, renameWorkoutSheet, sessionNoteSheet } from '../../sheets.jsx'
import { insertionIndexAfterCurrentUnit } from '../../lib/supersetFlow.js'
import { defaultIncrement, weightIncrement } from '../../lib/progression.js'
import { buildPlannedEntry, builtOutOfProgression } from '../../lib/session-start.js'
import { sessionNoProg, setSessionNoProg, joinSessionNoProg } from '../../lib/session-noprog.js'
import { markAllSetsDone, sessionHistory } from '../../lib/backfill.js'
import { isWarmupRow, isFailureSet, isDropSet, isRestPauseSet } from '../../lib/workout-model.js'
import { dropGrid } from '../../lib/plates.js'
import { withMeaning, historyAs, dbLoadFor, ownedWeightsFor } from '../../lib/dumbbells.js'
import { partsOf } from '../../lib/workout-parts.js'
import { setNumberAt, toggleWarmupRowAt, toggleFailureAt, addDropAt, addBurstAt, copySetAt, removeSetAt } from './workout-actions.js'

const state = () => useStore.getState().S
const update = (fn, local) => useStore.getState().update(fn, local)
const entryAt = idx => state().active?.entries?.[idx] || null

/** Set edit (W1.12). Fallback: the old set menu's actions. */
export function setEditSheet(idx, i) {
  const A = state().active
  const entry = A?.entries?.[idx]
  const s = entry?.sets?.[i]
  if (!s) return
  const editing = !!A.editingWorkoutId
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const perSide = isPerSide({ ...(entry.target || {}), id: entry.id })
  const warm = isWarmupRow(s)
  menuSheet({
    title: warm ? t('Warm-up') : t('Set {0}', setNumberAt(entry.sets, i)),
    subtitle: setLabel(entry.id, s, entry.target, state().speedUnit),
    sections: [
      { items: [
        !warm && mode === 'reps' && canBeWarmup(s) && entry.sets.some((x, j) => j !== i && !isWarmupRow(x)) && { icon: 'sunrise', label: t('Make it a warm-up set'), onClick: () => toggleWarmupRowAt(idx, i, true) },
        warm && mode === 'reps' && !perSide && { icon: 'dumbbell', label: t('Count it as a working set'), onClick: () => toggleWarmupRowAt(idx, i, false) },
        !warm && mode !== 'cardio' && { icon: 'gauge', label: t('Taken to failure'), sub: t('Nothing left in the tank'), on: isFailureSet(s), onClick: () => toggleFailureAt(idx, i) },
      ] },
      { title: t('Add to this set'), items: [
        !warm && mode === 'reps' && !isRestPauseSet(s) && { icon: 'arrowDown', label: t('Drop set'), sub: t('+ Drop'), onClick: () => addDropAt(idx, i) },
        !warm && mode === 'reps' && !isDropSet(s) && { icon: 'bolt', label: t('Rest-pause burst'), sub: t('+ Burst'), onClick: () => addBurstAt(idx, i) },
      ] },
      { items: [
        { icon: 'copy', label: t('Copy this set'), onClick: () => copySetAt(idx, i) },
        { icon: 'trash', label: t('Remove this set'), danger: true, disabled: !editing && entry.sets.length <= setSpanAt(entry.sets, i)[1], onClick: () => removeSetAt(idx, i, { editing }) },
      ] },
    ],
  })
}

/** How to (W1.14, W1.33, W1.34, W1.43). Fallback: the exercise drawer. */
export function howToSheet(idx) {
  const entry = entryAt(idx)
  if (entry) exerciseDetailSheet(exOr(entry.id))
}

/** Plate loading (W1.25). Fallback: the bar weight sheet. */
export function platesSheet(idx) {
  const entry = entryAt(idx)
  if (entry) barWeightSheet(entry.id, { ...(entry.target || {}), id: entry.id })
}

/** Time left on the rest (W1.4). Fallback: the rest bar's own sheet. */
export const restWheelSheet = () => adjustRestSheet()

/** An exercise's own rest, where 0:00 means the default applies. This session's, like
 * everything edited on the exercise from inside it; Update routine offers to keep it. */
export function exerciseRestSheet(idx) {
  const S = state()
  const entry = S.active?.entries?.[idx]
  if (!entry) return
  const activeId = S.active.id
  const entryId = entry.id
  durationSheet({
    title: t('Rest for this exercise'),
    value: entry.target?.restSec > 0 ? entry.target.restSec : 0, max: REST_MAX,
    off: t('Default ({0})', fmtRest(S.restSec)),
    footer: t('Rest after each set of this exercise. 0:00 means your default rest.'),
    onDone: v => update(s => {
      const e = s.active?.id === activeId ? s.active.entries?.[idx] : null
      if (!e || e.id !== entryId) return
      e.target = { ...(e.target || {}), restSec: v }
    }),
  })
}

/** The map (W1.37, W1.45). Fallback: a menu of the exercises; a tap makes one current. */
export function workoutMapSheet() {
  const A = state().active
  if (!A) return
  menuSheet({
    title: t('All exercises'),
    items: A.entries.map((e, idx) => ({
      icon: e.sets.length && e.sets.every(s => s.done) ? 'checkCircle' : 'dumbbell',
      label: exerciseNameText(exOr(e.id)),
      on: idx === A.cur,
      onClick: () => update(s => { if (s.active?.entries?.[idx]) s.active.cur = idx }),
    })),
  })
}

/**
 * Add exercise (W1.18). After `afterIdx` (null: after the current unit), into `part` when given
 * (the end of that part's run, so the parts stay in order). A freehand add inherits the current
 * unit's routine (`rid`) and its block's `noProg`; a session kept out as a whole takes it too.
 * `onShift` is the old Focus screen's pointer, moved before the list changes.
 */
export function addExerciseSheet(afterIdx = null, part = null, { onShift } = {}) {
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
      onShift?.()
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
        if (into) {
          const run = partsOf(s.active.entries).find(p => p.part === into)
          insertAt = run ? run.to + 1 : into === 'warmup' ? 0 : s.active.entries.length
        }
        s.active.entries.splice(insertAt, 0, joinSessionNoProg(s.active, { id: ex.id, ...built, ...(curRid ? { rid: curRid } : {}), ...(noProg ? { noProg: true } : {}), ...(into ? { part: into } : {}) }))
        s.active.cur = insertAt
        useUI.getState().shiftRestOwner(insertAt, 1)
      })
    }
    // The picker row's "+" adds at once with the config the sheet would have opened with.
    if (quick) { commit(seed || defaultConfig(ex.id)); useUI.getState().toast(t('“{0}” added to {1}', exerciseNameText(ex), routine ? routine.name : t('Freestyle'))) }
    else exConfigSheet(ex, null, commit, null, routine, seed, null, t('Add to this workout'))
  })
}

/** Ending the session without saving it. */
export const discardWorkoutConfirm = () => confirmSheet({
  title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true,
  onConfirm: () => { update(s => { s.active = null }); useUI.getState().stopRest(); useUI.getState().stopWork(); back() },
})

/**
 * Workout options (W1.20). Fallback: the old header ⋯ menu without Layout. `markAllDone` is the
 * hook's (it re-baselines the progress marks); without it the sets are ticked here.
 */
export function workoutOptionsSheet({ markAllDone, addExercise } = {}) {
  const S = state()
  const A = S.active
  if (!A) return
  const editing = !!A.editingWorkoutId
  const keepsOut = e => !!e?.rid && S.routines.some(r => r.id === e.rid && r.excludeFromProgression === true)
  const switchable = !A.entries.length || A.entries.some(e => !keepsOut(e))
  const markAll = markAllDone || (() => {
    update(s => { if (s.active) s.active.entries = markAllSetsDone(s.active.entries) }, true)
    workoutCompleteSheet()
  })
  menuSheet({
    sections: [
      { items: [
        { icon: 'gear', accent: true, chevron: true, label: t('Workout settings'),
          sub: [S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer'), S.sound ? t('Sound') : t('Silent')].join(' · '),
          onClick: workoutSettingsSheet },
      ] },
      { title: t('Add'), items: [
        { icon: 'plusCircle', label: t('Add exercise'), onClick: () => (addExercise ? addExercise() : addExerciseSheet()) },
        !editing && { icon: 'clipboard', label: t('Add routine'), sub: t('Bring another routine into this session'), onClick: addRoutineToSessionSheet },
      ] },
      { title: t('This workout'), items: [
        A.backfill && A.entries.length > 0 && { icon: 'checkCircle', label: t('Mark all sets done'), onClick: markAll },
        { icon: 'pencil', label: t('Rename workout'), onClick: renameWorkoutSheet },
        { icon: 'note', label: A.note ? t('Edit session note') : t('Add session note'), onClick: sessionNoteSheet },
        switchable && { icon: 'chartLineSlash', label: t('Don’t count for progression'), sub: t('Every exercise in this workout'), on: sessionNoProg(A),
          onClick: () => update(s => setSessionNoProg(s.active, !sessionNoProg(s.active), keepsOut)) },
      ] },
      { items: [
        !editing && { icon: 'trash', label: t('Discard workout'), danger: true, onClick: discardWorkoutConfirm },
      ] },
    ],
  })
}
