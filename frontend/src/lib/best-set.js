// An exercise's best logged set, worded for a line under its name: "82.5 kg × 6" and the day it was
// done. Shared by the exercise drawer's head, the Exercises pages' rows and the Progress page's
// Best set tile.
import { fmtNum } from './format.js'
import { bellsIn, currentDbLoad, dbLoadOf } from './dumbbells.js'
import { bestSetFor } from './exercise-history.js'
import { isBw, lastEntryFor, modeOf, setLabel } from './history.js'
import { t } from './i18n.js'
import { speedUnitOf } from './speed.js'
import { isSideSet } from './workout-model.js'

/**
 * The best set in the mode the exercise was last logged in, read in its current dumbbell meaning:
 * `{ label, d, value, rest }`, or null when there is none. A plain loaded set reads "82.5 kg × 6"
 * (with its unit, as the boards draw it); a timed or cardio one keeps `setLabel`'s own wording.
 *
 * `value` and `rest` are the same set in two halves, for a tile that shows the load big and the
 * reps under it, so nobody splits the label: "82.5 kg" and "× 6", "+10 kg" and "× 8" for a belt,
 * "20 kg each" and "× 8" per hand, and "12" and "reps" for a set with no load. A set that has no
 * such halves (a hold, a run, a set logged per side) is `value` alone, with `rest` null.
 */
export function bestSetLabel(S, ex) {
  const last = lastEntryFor(S, ex.id)
  const mode = modeOf({ ...(last?.target || {}), id: ex.id })
  const best = bestSetFor(S, ex.id, mode, currentDbLoad(S, ex.id))
  if (!best) return null
  let label = setLabel(ex.id, best.set, best.target, speedUnitOf(S))
  const plain = fmtNum(best.set.w) + '×'
  if (mode === 'reps' && best.set.w > 0 && label.startsWith(plain)) label = `${fmtNum(best.set.w)} ${S.unit} × ${label.slice(plain.length)}`
  return { label, d: best.d, ...partsOf(S, ex.id, mode, best, label) }
}

function partsOf(S, exId, mode, best, label) {
  if (mode !== 'reps' || isSideSet(best.set)) return { value: label, rest: null }
  const cfg = { ...(best.target || {}), id: best.target?.id ?? exId }
  const w = Number(best.set.w) || 0
  const bw = isBw(cfg)
  if (bw && !(w > 0)) return { value: label, rest: t('reps') }
  // Everything after the load: the reps, with any bursts, drops, failure mark and effort.
  const cut = label.indexOf('×')
  if (cut < 0) return { value: label, rest: null }
  const load = fmtNum(w) + ' ' + S.unit
  const meaning = !bw && bellsIn(cfg) === 2 ? dbLoadOf(cfg.dbLoad) : null
  const value = bw ? '+' + load
    : meaning === 'each' ? t('{0} each', load)
      : meaning === 'total' ? t('{0} total', load)
        : load
  return { value, rest: '× ' + label.slice(cut + 1).trim() }
}
