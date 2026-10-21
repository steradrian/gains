// The entry that takes the place of an active entry when it is swapped for another exercise.
// Pure state in, entry out: the running workout's Swap step (views/workout/workout-actions.js)
// and the picker's swap (sheets/exercise-picker.jsx) both build it here.
import { buildSets, modeOf, applyIntensifierPlan } from './history.js'
import { dropGrid } from './plates.js'
import { dbLoadFor, withMeaning, historyAs, ownedWeightsFor } from './dumbbells.js'
import { defaultIncrement, weightIncrement } from './progression.js'
import { buildPlannedEntry, builtOutOfProgression } from './session-start.js'
import { sessionHistory } from './backfill.js'

/**
 * The entry that takes the place of the active entry `current` when it is swapped for `ex` with
 * `cfg`.
 */
export function swapReplacement(st, current, ex, cfg) {
  const full = { ...cfg, id: ex.id }
  // A swap is an in-place substitution — routine identity is unchanged, so the replacement
  // keeps the slot's own `rid` and reads its prescription from that routine (not a
  // session-wide one). A slot with no `rid` is freestyle.
  const slotRoutine = current.rid ? st.routines.find(r => r.id === current.rid) : null
  const freestyle = !slotRoutine
  // Same rows the add flow builds: last time's loads and, in a planned session, the
  // prescription — swapping barbell for dumbbell bench must not start you at an empty bar.
  // Built from what came before the session's day when it is logged into the past (sessionHistory).
  const step = modeOf(full) === 'reps' ? weightIncrement(full, st.unit) : defaultIncrement(ex.id, st.unit)
  const past = sessionHistory(st)
  // A freestyle swap logs dumbbell weights the way the exercise means them now, and starts
  // from last time read in that meaning (lib/dumbbells.js), as a planned one does.
  const built = freestyle
    ? { target: withMeaning(st, cfg, ex.id), plan: null, sets: applyIntensifierPlan(buildSets(historyAs(past, ex.id, dbLoadFor(st, full)), full, { step: (modeOf(full) === 'reps' && ownedWeightsFor(st, full)) || step, preferLast: true }), full, dropGrid(st, full)) }
    : buildPlannedEntry(past, full, slotRoutine, { noProg: builtOutOfProgression(current, slotRoutine) })
  return {
    id: ex.id,
    ...built,
    ...(current.rid ? { rid: current.rid } : {}),
    // A slot kept out of progression stays out once swapped. Replaced in place the entry keeps
    // it anyway; inserted beside logged sets, the replacement would otherwise count as a
    // regular session of the new exercise. Only a deload or rehab slot is built without a
    // prescription (above): one kept out by hand keeps the marker and its Undo on the card,
    // and an Undo must leave numbers that are right to count.
    ...(current.noProg === true ? { noProg: true } : {}),
  }
}
