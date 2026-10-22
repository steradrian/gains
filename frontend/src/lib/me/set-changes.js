// Journal kind `set-delete`: a set taken out of a saved workout when its edit is saved
// (sheets/workout-flow.jsx saveWorkoutEdits). A set deleted in a workout that is still running
// keeps its own 8 s Undo and is not journalled.
//
//   snapshot: { workoutKey, entryId, occ, index, set }
//             workoutKey  the saved workout's id (or its frozen legacy key)
//             entryId     the exercise's id
//             occ         which entry of that exercise (0 = the first; an exercise can appear twice)
//             index       where the set stood among its entry's sets
//             set         the set as it was
//   subject:  the exercise's name        facts: { day, weight, reps }
//
// Which sets an edit removed is read by comparing the sets of each entry before and after: sets
// that are still there unchanged are matched first, then each set that is only in the new list is
// taken for an edited one and paired with the nearest unmatched old set; the old sets left over
// were removed. An exercise taken out whole is not journalled (no entry to put a set back into).
//
// Restore puts the set back at its index while the workout and the entry still exist and stamps
// the workout (stampWorkout), so the sync keeps the restored version over an older copy.
import { bestWeightForEntry, workoutDay, workoutVolume } from '../history.js'
import { exOr } from '../exercises.js'
import { sameWorkout } from '../workout-date.js'
import { stampWorkout } from '../sync-merge.js'
import { registerRestorer, recordChange } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'

export const SET_DELETE = 'set-delete'

const list = v => (Array.isArray(v) ? v : [])
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const keyOf = w => (w?.id != null ? w.id : `${w?.d}|${w?.start}`)

// The entries of `rec` that are the `occ`-th of their exercise: [{ entry, id, occ }].
function occurrences(rec) {
  const seen = new Map()
  return list(rec?.entries).filter(e => e && e.id != null).map(entry => {
    const occ = seen.get(entry.id) || 0
    seen.set(entry.id, occ + 1)
    return { entry, id: entry.id, occ }
  })
}

/** Indexes of `before` that `after` no longer has, from the comparison described above. */
export function removedIndexes(before, after) {
  const b = list(before), a = list(after)
  // Longest common run of equal sets, so a set deleted from the middle does not shift the rest.
  const lcs = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0))
  for (let i = b.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) lcs[i][j] = same(b[i], a[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const keptOld = new Set(), keptNew = new Set()
  for (let i = 0, j = 0; i < b.length && j < a.length;) {
    if (same(b[i], a[j])) { keptOld.add(i); keptNew.add(j); i++; j++ } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++; else j++
  }
  const open = b.map((_, i) => i).filter(i => !keptOld.has(i))
  // A set only the new list has is an old one that was edited.
  for (let j = 0; j < a.length; j++) {
    if (keptNew.has(j) || !open.length) continue
    let best = 0
    open.forEach((i, k) => { if (Math.abs(i - j) < Math.abs(open[best] - j)) best = k })
    open.splice(best, 1)
  }
  return open
}

/** Every set `after` lost from `before` (saved workout records), as set-delete snapshots. */
export function removedSets(before, after) {
  const now = new Map(occurrences(after).map(o => [`${o.id}#${o.occ}`, o.entry]))
  const out = []
  for (const { entry, id, occ } of occurrences(before)) {
    const kept = now.get(`${id}#${occ}`)
    if (!kept) continue
    for (const index of removedIndexes(entry.sets, kept.sets)) {
      out.push({ workoutKey: keyOf(before), entryId: id, occ, index, set: clone(entry.sets[index]) })
    }
  }
  return out
}

/** Journals each set the saved edit removed. `before` and `saved` are the workout record either side of the save. */
export function recordSetDeletes(before, saved) {
  try {
    if (!before || !saved) return []
    const day = workoutDay(saved) || workoutDay(before) || ''
    return removedSets(before, saved).map(snapshot => recordChange({
      kind: SET_DELETE, day: day || undefined, subject: exOr(snapshot.entryId).n || '',
      facts: { day, weight: snapshot.set?.w ?? null, reps: snapshot.set?.r ?? null }, snapshot,
    }))
  } catch { return [] }
}

// The entry the snapshot names in draft `s`, with its workout: { w, e } or null.
function locate(s, snap) {
  const w = list(s.workouts).find(x => sameWorkout(x, { id: snap.workoutKey }))
  const e = w && occurrences(w).find(o => o.id === snap.entryId && o.occ === snap.occ)?.entry
  return e ? { w, e } : null
}

// A changed entry's summary numbers, worked out again as the Save works them.
function refresh(w, e) {
  e.topW = bestWeightForEntry(e) || null
  w.vol = workoutVolume(w)
  // Always after the stamp it had, so the store sees the workout as edited now.
  stampWorkout(w, Math.max(Date.now(), (Number(w._ts) || 0) + 1))
}

export function restoreSetChange(snap) {
  if (!snap?.set || snap.workoutKey == null) return { ok: false, reason: 'gone' }
  const st = useStore.getState()
  if (!locate(st.S, snap)) return { ok: false, reason: 'gone' }
  let where = null
  st.update(s => {
    const hit = locate(s, snap)
    if (!hit) return
    if (!Array.isArray(hit.e.sets)) hit.e.sets = []
    const index = Math.min(Math.max(0, snap.index), hit.e.sets.length)
    hit.e.sets.splice(index, 0, clone(snap.set))
    refresh(hit.w, hit.e)
    where = { day: workoutDay(hit.w) || '', index }
  })
  return where ? { ok: true, where } : { ok: false, reason: 'gone' }
}

/** Takes the restored set out again, where the restore put it. */
export function undoSetRestore(snap, _S, result) {
  if (!snap?.set) return { ok: false, reason: 'gone' }
  const wanted = Number.isInteger(result?.where?.index) ? result.where.index : snap.index
  let ok = false
  useStore.getState().update(s => {
    const hit = locate(s, snap)
    if (!hit) return
    const sets = list(hit.e.sets)
    const i = same(sets[wanted], snap.set) ? wanted : sets.findIndex(x => same(x, snap.set))
    if (i < 0) return
    sets.splice(i, 1)
    refresh(hit.w, hit.e)
    ok = true
  })
  return ok ? { ok: true } : { ok: false, reason: 'gone' }
}

registerRestorer(SET_DELETE, { restore: restoreSetChange, undo: undoSetRestore })
