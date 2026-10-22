import { plusDays } from '../missed-day.js'
import { dayFiguresOf } from '../nutrition/trends.js'

// S.targetsReached (PR-09 decision 3), the one thing Friends reads of the diary:
//
//   { 'YYYY-MM-DD': { all: boolean, protein: boolean } }   the last 14 closed days
//
// `all` is the day "on target" exactly as Eat's week hero and Month judge it (dayFiguresOf:
// band 'on', within ON_TARGET_KCAL of that day's own target); `protein` is the protein target alone
// reached. The server reads this and never works out a food target (decision 3), so the figures
// here are the same ones the person sees. A day that cannot be judged is left out: no food logged,
// no goal for that day, or no protein goal. Unknown is not "missed". Today is left out too, it is
// still being logged; it comes in when the next day starts.

export const TARGETS_DAYS = 14

/** The 14 closed days before `today`, oldest first. */
export const targetDatesOf = today => Array.from({ length: TARGETS_DAYS }, (_, i) => plusDays(today, i - TARGETS_DAYS))

/**
 * The map for the days before `today`, from what the Eat pages read (`days` is the diary,
 * `settings`, `goalInputs`, `activity` and `tried` as useFoodHistory hands them), or null while a
 * logged day's target is still loading: a half-judged window is never written.
 */
export function computeTargetsReached({ days, settings, goalInputs = {}, activity = {}, tried = {}, today }) {
  if (!settings) return null
  const byDate = new Map((days || []).map(d => [d.date, d]))
  const out = {}
  for (const date of targetDatesOf(today)) {
    const entry = byDate.get(date)
    if (!(entry?.items?.length > 0)) continue
    const f = dayFiguresOf({ settings, entry, date, goalInputs, activity: activity[date] || null, tried: !!tried[date] })
    if (!f) return null
    if (f.band == null || !(f.proteinTarget > 0)) continue
    out[date] = { all: f.band === 'on', protein: f.protein >= f.proteinTarget }
  }
  return out
}
