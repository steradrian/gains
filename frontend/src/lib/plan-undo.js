// Importing a plan file with an Undo (PR02 T3.7 → T4.4). The import adds routines, may create
// custom exercises and may replace the week; the Undo takes away exactly what it added and puts the
// week back. Both run on store drafts (`update(s => …)`), so sync sees ordinary edits: a removed
// routine or exercise is recorded in `deleted`, and the caller marks the weekdays it put back
// (sync-merge.js undoMarks / markUndone), so an edit another device made meanwhile still wins.
import { mergePlan } from './plan-share.js'
import { deleteRoutine } from './routines.js'

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

/**
 * Imports `bundle` (parsePlan's) into the draft `s` as new routines, marked `importedFrom`, and with
 * `schedule` its week in place of yours. Returns what an Undo needs: `{ ids, exIds, week }`, where
 * `week` is null unless the week was replaced, else `{ before, after }`, the week on each side.
 */
export function importPlan(s, bundle, { schedule = false } = {}) {
  const before = clone(s.week || {})
  const res = mergePlan(s, bundle, { schedule, imported: true })
  return { ids: res.ids, exIds: res.exIds, week: res.scheduled ? { before, after: clone(s.week) } : null }
}

/**
 * Undoes `done` (importPlan's answer) on the draft `s`:
 * - each weekday the import wrote and nothing changed since goes back to what it was;
 * - the routines it added go, with their places on the week and their reschedules (deleteRoutine);
 * - the custom exercises it created go, unless something uses one by now: a logged workout, the
 *   workout running, or a routine of yours.
 * Returns how many routines it took away (none when a sync or a delete got there first).
 */
export function undoImport(s, done) {
  if (done.week) {
    s.week = s.week || {}
    const { before, after } = done.week
    for (const d of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!same(s.week[d], after[d])) continue
      if (before[d] == null) delete s.week[d]
      else s.week[d] = clone(before[d])
    }
  }
  let removed = 0
  for (const id of done.ids) {
    if (!(s.routines || []).some(r => r.id === id)) continue
    deleteRoutine(s, id)
    removed++
  }
  if (done.exIds.length && Array.isArray(s.customEx)) {
    const used = new Set()
    for (const w of [...(s.workouts || []), s.active].filter(Boolean)) for (const e of w.entries || []) used.add(e.id)
    for (const r of s.routines || []) for (const e of r.ex || []) used.add(e.id)
    s.customEx = s.customEx.filter(c => !done.exIds.includes(c.id) || used.has(c.id))
  }
  return removed
}
