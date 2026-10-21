// An exercise's best logged set, worded for a line under its name: "82.5 kg × 6" and the day it was
// done. Shared by the exercise drawer's head and the Exercises pages' rows.
import { fmtNum } from './format.js'
import { currentDbLoad } from './dumbbells.js'
import { bestSetFor } from './exercise-history.js'
import { lastEntryFor, modeOf, setLabel } from './history.js'
import { speedUnitOf } from './speed.js'

/**
 * The best set in the mode the exercise was last logged in, read in its current dumbbell meaning:
 * `{ label, d }`, or null when there is none. A plain loaded set reads "82.5 kg × 6" (with its unit,
 * as the boards draw it); a timed or cardio one keeps `setLabel`'s own wording.
 */
export function bestSetLabel(S, ex) {
  const last = lastEntryFor(S, ex.id)
  const mode = modeOf({ ...(last?.target || {}), id: ex.id })
  const best = bestSetFor(S, ex.id, mode, currentDbLoad(S, ex.id))
  if (!best) return null
  let label = setLabel(ex.id, best.set, best.target, speedUnitOf(S))
  const plain = fmtNum(best.set.w) + '×'
  if (mode === 'reps' && best.set.w > 0 && label.startsWith(plain)) label = `${fmtNum(best.set.w)} ${S.unit} × ${label.slice(plain.length)}`
  return { label, d: best.d }
}
