import { buildPlanBundle } from './plan-share.js'

/**
 * One routine as a plan file (T5.8 Share routine › As a plan file): the plan bundle with only
 * routine `id` in it and the custom exercises it uses, named after the routine, so whoever
 * imports it sees "imported from Push A". No weekdays travel with it: one routine's days say
 * nothing about the importer's week. Null when there is no such routine.
 */
export function buildRoutineBundle(S, id) {
  const r = (S.routines || []).find(x => x.id === id)
  if (!r) return null
  return buildPlanBundle({ ...S, routines: [r], week: {} }, r.name)
}
