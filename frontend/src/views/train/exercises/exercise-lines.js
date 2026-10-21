import { MUSCLE_NAME } from '../../../lib/muscles.js'
import { bestSetLabel } from '../../../lib/best-set.js'
import { fmtNum } from '../../../lib/format.js'
import { getLang, t } from '../../../lib/i18n.js'
import { best1RM, formulaOf } from '../../../lib/onerm.js'
import { speedUnitOf } from '../../../lib/speed.js'

/** A catalogue word ("upper arms", "body weight") as the first word of a label: "Upper arms". */
export const sentence = s => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

/** "Pectorals · leverage machine": what trains it and with what, the line under a library row. */
export const libraryLine = ex => [sentence(t(MUSCLE_NAME[ex.tg] || ex.tg || ex.bp)), t(ex.eq)].filter(Boolean).join(' · ')

// Each row of the list asks for its exercise's best set and estimate, and both walk the whole log.
// They are kept per exercise, for as long as the log, the units, the formula, the dumbbell
// meanings and the language they were read under stay as they are, so typing in the search box
// (which re-renders every row) reads them back instead of rescanning the workouts each time.
let summaries = { workouts: null, dbLoad: null, key: '', byId: new Map() }

function summaryOf(S, ex) {
  const key = [S.unit, speedUnitOf(S), formulaOf(S), getLang()].join('|')
  if (summaries.workouts !== S.workouts || summaries.dbLoad !== S.dbLoad || summaries.key !== key) {
    summaries = { workouts: S.workouts, dbLoad: S.dbLoad, key, byId: new Map() }
  }
  let summary = summaries.byId.get(ex.id)
  if (!summary) {
    summary = { best: bestSetLabel(S, ex), est: best1RM(S, ex.id) }
    summaries.byId.set(ex.id, summary)
  }
  return summary
}

/**
 * The line under an exercise you have logged: "Best 82.5 kg × 6 · est. 1RM 96 kg". The estimate
 * is left out when there is none (an assisted machine, no loaded set); an exercise with no best
 * set reads like a library row.
 */
export function loggedLine(S, ex) {
  const { best, est } = summaryOf(S, ex)
  if (!best) return libraryLine(ex)
  return [t('Best {0}', best.label), est && t('est. 1RM {0}', fmtNum(Math.round(est.est)) + ' ' + S.unit)].filter(Boolean).join(' · ')
}
