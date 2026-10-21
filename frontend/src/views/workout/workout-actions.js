// The running workout's store mutations, shared by the workout screen and its drawers (PR-03).
// Plain functions over the store's `update`: no React, so a drawer, a hardware key and the screen
// all change a set the same way. Moved here from views/Workout.jsx (the set helpers and the
// per-set mutations ExerciseBlock and ActiveWorkout made inline); Workout.jsx re-exports the
// helpers its tests import.
//
// Rows have no id of their own, so whatever points at a row by its index has to move with it:
// the running hold (its callback writes the seconds to a row) and the rest a set started
// (timer.forSet). Removing the set either one belongs to stops it first; Undo does not start it
// again. Rows above or below just shift.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { exOr } from '../../lib/exercises.js'
import { dropGrid } from '../../lib/plates.js'
import { stepEffort, cascadeWeight, makeWarmupAt, makeWorkAt, removeRowAt, setSpanAt, copyRowAt, copySpanAt, insertRowAt, pairAdjacent, unpairSuperset, cleanupSg, supersetUnits } from '../../lib/history.js'
import { t, exerciseNameFor } from '../../lib/i18n.js'
import { stepWeight } from '../../lib/progression.js'
import { stepOwned } from '../../lib/dumbbells.js'
import { isWarmupRow, isFailureSet, toggleFailure, dropsOf, clustersOf, addDrop, addCluster, removeDropAt, removeClusterAt, setDropAt, setClusterAt, nextDropWeight, nextBurstReps, isSideSet, setSideField, addSideDrop, removeSideDropAt, setSideDropAt, addSideCluster, removeSideClusterAt, setSideClusterAt, WEIGHT_ORIGIN_MANUAL } from '../../lib/workout-model.js'
import { canMoveActiveWorkoutUnit, moveActiveWorkoutUnit } from '../../lib/active-workout-order.js'
import { partOf, normaliseParts } from '../../lib/workout-parts.js'

const update = (fn, push = true) => useStore.getState().update(fn, push)
const activeNow = () => useStore.getState().S.active
// UI state written from here and from effects; a test that stubs the UI store without setState
// simply does not see it.
const setUI = patch => useUI.setState?.(patch)

/* ---------- row references: the running hold and the rest a set started ---------- */
let holdAt = null    // { owner, idx, i }: the row a running hold will write to (startTimed)
let flashSeq = 0
/** The row a running hold writes to, `{ owner, idx, i }` or null. */
export const holdRow = () => holdAt
export const setHoldRow = v => { holdAt = v }
/** Flash a row (it came back, or it is a copy): bumps the flash id so the same row can flash twice. */
export const flashRow = (idx, i) => setUI({ setFlash: { idx, i, id: ++flashSeq } })

export const shiftRowRefs = (idx, from, by) => {
  if (holdAt && holdAt.idx === idx && holdAt.i >= from) holdAt = { ...holdAt, i: holdAt.i + by }
  // The hold's saved owner (useUI.work.owner, what a reload brings it back to) moves with it.
  const wk = useUI.getState().work
  if (wk?.owner && wk.owner.idx === idx && wk.owner.i >= from) setUI({ work: { ...wk, owner: { ...wk.owner, i: wk.owner.i + by } } })
  const rest = useUI.getState().timer
  if (rest && rest.forIdx === idx && rest.forSet != null && rest.forSet >= from) setUI({ timer: { ...rest, forSet: rest.forSet + by } })
}

/* ---------- moved from views/Workout.jsx ---------- */
/** The number a set row shows: counted per phase (warm-ups and work sets each from 1), and a
 *  timed per-side L/R pair as one set. */
export function setNumberAt(sets, i) {
  const s = sets[i]
  const warm = isWarmupRow(s)
  const phaseNum = sets.slice(0, i + 1).filter(x => isWarmupRow(x) === warm).length
  return s?.side ? Math.ceil(phaseNum / 2) : phaseNum
}
/** Removes set `i` of active entry `idx`, with an Undo on the toast. In a live session one set
 *  always stays (removeRowAt); the editor of a saved workout may take them all. */
export function deleteActiveSet(idx, i, { editing = false } = {}) {
  const A = activeNow()
  const e = A?.entries?.[idx]
  const row = e?.sets?.[i]
  if (!row) return false
  const ui = useUI.getState()
  // A timed per-side hold is an L row and an R row that read as one set: both go, and both come back.
  const [start, count] = setSpanAt(e.sets, i)
  if (!editing && e.sets.length <= count) { ui.toast(t('Keep at least one set, champ')); return false }
  const inSpan = j => j != null && j >= start && j < start + count
  let stopped = false
  const holdHere = ui.work && ((holdAt && holdAt.idx === idx && inSpan(holdAt.i)) || (ui.work.owner && ui.work.owner.idx === idx && inSpan(ui.work.owner.i)))
  if (holdHere) { holdAt = null; ui.stopWork(); stopped = true }
  const rest = ui.timer
  if (rest && rest.forIdx === idx && inSpan(rest.forSet)) { ui.stopRest(); stopped = !rest.ready || stopped }
  shiftRowRefs(idx, start + count, -count)
  const n = setNumberAt(e.sets, i)
  const warm = isWarmupRow(row)
  const token = { activeId: A.id, idx, entryId: e.id, i: start, rows: structuredClone(e.sets.slice(start, start + count)) }
  update(s => {
    const en = s.active?.entries?.[idx]
    if (!en) return
    if (editing) en.sets.splice(start, count)
    else en.sets = removeRowAt(en.sets, i)
  })
  const msg = warm ? t('Warm-up gone.') : stopped ? t('Set {0} gone. Its timer stopped too.', n) : t('Set {0} gone.', n)
  ui.toast(msg, { action: t('Undo'), onAction: () => undoDeleteSet(token) })
  return true
}
/** Puts a removed set back exactly as it was, at its old place in the same exercise. If the
 *  exercise moved, it is found by its id; if it is gone, or the workout is, there is nothing to
 *  put it back into. */
export function undoDeleteSet(token) {
  const A = activeNow()
  const ui = useUI.getState()
  const at = !A || A.id !== token.activeId ? -1
    : A.entries[token.idx]?.id === token.entryId ? token.idx
      : A.entries.findIndex(en => en.id === token.entryId)
  if (at < 0) { ui.toast(t('Too late, that one’s gone')); return false }
  const rows = token.rows || [token.row]
  const i = Math.min(token.i, A.entries[at].sets.length)
  shiftRowRefs(at, i, rows.length)
  update(s => {
    const en = s.active.entries[at]
    en.sets = rows.reduce((acc, r, k) => insertRowAt(acc, i + k, r), en.sets)
  })
  flashRow(at, i)
  return true
}
/** "One more like this one": a copy of set `i` right below it (lib/history.js copyRowAt). */
export function copyActiveSet(idx, i) {
  const e = activeNow()?.entries?.[idx]
  if (!e?.sets?.[i]) return false
  const { start, end } = copySpanAt(e.sets, i)
  shiftRowRefs(idx, end + 1, end - start + 1)
  update(s => {
    const en = s.active?.entries?.[idx]
    if (en) en.sets = copyRowAt(en.sets, i)
  })
  flashRow(idx, end + 1)
  useUI.getState().toast(t('Copied. One more like that one.'))
  return true
}
export function removeActiveExercise(idx) {
  // Clear the work callback before indexes can shift. This also protects a confirmation sheet
  // that was opened first and confirmed after a timed hold started.
  useUI.getState().stopWork()
  // A rest countdown belongs to the exercise whose set started it (timer.forIdx). Removing that
  // exercise ends the rest — there is nothing left to rest for. Removing any other exercise
  // keeps the countdown and only re-points it, so a pause you are in the middle of survives
  // tidying up the list.
  const rest = useUI.getState().timer
  if (rest && rest.forIdx === idx) useUI.getState().stopRest()
  else useUI.getState().shiftRestOwner(idx + 1, -1)
  update(s => {
    if (!s.active || !Array.isArray(s.active.entries)) return
    if (idx < 0 || idx >= s.active.entries.length) return
    s.active.entries.splice(idx, 1)
    cleanupSg(s.active.entries)
    if (idx < s.active.cur) s.active.cur--
    if (s.active.cur >= s.active.entries.length) s.active.cur = Math.max(0, s.active.entries.length - 1)
  })
}

/* ---------- one set's fields ---------- */
const mutSet = (idx, i, fn) => update(s => {
  const e = s.active?.entries?.[idx]
  if (e?.sets?.[i]) e.sets[i] = fn(e.sets[i], e, s)
})
const freshSet = (idx, i) => activeNow()?.entries?.[idx]?.sets?.[i]

// Clearing an optional field drops the key rather than storing null, so a set only carries
// what was actually logged — in the session, in history and in a backup.
export const setFieldAt = (idx, i, field, v) => update(s => {
  const e = s.active?.entries?.[idx]
  if (!e?.sets?.[i]) return
  if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
  // Typing a duration IS the new plan, the same way ticking the row ends it: a plan a displaced
  // hold put aside must not outrank what you just typed, or the field would read 45 and the ▶
  // would still hold the 30 the row was asking for before.
  if (field === 'sec') delete e.sets[i].planSec
  // Changing a work set's weight cascades to the following inherited work sets, so a correction
  // carries through without retyping every row while explicit manual exceptions stay put. A
  // warm-up edit stays on its own row, and the later rungs keep their ramp loads.
  if (field === 'w') {
    e.sets[i].weightOrigin = WEIGHT_ORIGIN_MANUAL
    e.sets = cascadeWeight(e.sets, i, v, undefined, e.target?.backoffStep)
  }
})

/** + or − on a load: from owned bell to owned bell when the profile lists them (#376), else along the step. */
export const stepLoad = (v, step, dir, owned = null) => (owned ? stepOwned(owned, v, dir) : stepWeight(v, step, dir))

/**
 * One tap of + or − on a set's field. `col` is `{ f, step, view?, store? }` (a column that shows
 * a converted number, cardio speed, steps in the unit on screen); `weight` says the field is a
 * rep exercise's load, which walks the owned bells or the weight grid. Reads the value live from
 * the store: a superset re-render can stale a closure's row before the next tap.
 */
export function stepFieldAt(idx, i, col, dir, { weight = false, owned = null } = {}) {
  const cur = freshSet(idx, i)?.[col.f]
  if (weight) return setFieldAt(idx, i, col.f, stepLoad(cur, col.step, dir, owned))
  const shown = col.view && cur != null && cur !== '' ? col.view(cur) : cur
  const next = Math.max(0, Math.round(((shown || 0) + dir * col.step) * 100) / 100)
  return setFieldAt(idx, i, col.f, col.store ? col.store(next) : next)
}

/** The effort on a set, RIR or RPE (`field` is `rir` or `rpe`); null clears it. */
export const setEffortAt = (idx, i, field, v) => setFieldAt(idx, i, field, v)
/** One step along the effort scale (`kind` 'rir' | 'rpe', lib/history.js stepEffort). */
export const stepEffortAt = (idx, i, kind, field, dir) => setFieldAt(idx, i, field, stepEffort(kind, freshSet(idx, i)?.[field] ?? null, dir))

/** Warm-up or work is the row's phase; switching it moves the row to the edge of the warm-ups. */
export const toggleWarmupRowAt = (idx, i, warm) => update(s => {
  const e = s.active?.entries?.[idx]
  if (e) e.sets = warm ? makeWarmupAt(e.sets, i) : makeWorkAt(e.sets, i)
})

/** Taken to failure, on or off, for the whole set (both rows of a timed per-side pair). */
export const toggleFailureAt = (idx, i) => update(s => {
  const e = s.active?.entries?.[idx]
  if (!e?.sets?.[i]) return
  const [start, count] = setSpanAt(e.sets, i)
  const on = !isFailureSet(e.sets[i])
  for (let j = start; j < start + count; j++) if (isFailureSet(e.sets[j]) !== on) e.sets[j] = toggleFailure(e.sets[j])
})

/* ---------- drops and bursts ---------- */
// Drops/bursts mutate the row in place — same card, not a new set with its own long rest.
// A planned exercise (see the exercise's "Intensifier" config) arrives with these already
// filled in by applyIntensifierPlan; these only add/edit/remove entries live from here on.
export const addDropAt = (idx, i) => mutSet(idx, i, (row, entry, s) => {
  const pct = entry.target?.intensifier?.type === 'dropset' ? entry.target.intensifier.pct : undefined
  const grid = dropGrid(s, { ...entry.target, id: entry.id })
  // A unilateral set drops per side (issue #60): addSideDrop seeds each side from its own weight.
  if (isSideSet(row)) return addSideDrop(row, pct, grid)
  const drops = dropsOf(row)
  const base = drops.length ? drops[drops.length - 1].w : (row.w || 0)
  // On a weight you can load: the plates you own, else the exercise's step (lib/plates.js).
  return addDrop(row, { w: nextDropWeight(base, pct, grid), r: row.r })
})
// A rest-pause row's own reps are always the total across every burst (see
// applyIntensifierPlan/history.js) — clusters are the breakdown of that total, not extra on
// top of it — so adding, removing or editing one keeps `r` in step by the same delta.
export const addBurstAt = (idx, i) => mutSet(idx, i, (row, entry, s) => {
  const restSec = entry.target?.intensifier?.type === 'restpause' ? entry.target.intensifier.restSec : (s.restPauseSec || 15)
  if (isSideSet(row)) return addSideCluster(row, restSec)   // per side, each keeps its own r in step
  const clusters = clustersOf(row)
  const base = clusters.length ? clusters[clusters.length - 1].r : (row.r || 0)
  const added = nextBurstReps(base)
  return { ...addCluster(row, { r: added, restSec }), r: (row.r || 0) + added }
})
// Drop/burst edits accept an optional `side` ('L'|'R'): present for a per-side row (edits that
// one limb's drop/burst), absent for a straight row (edits the row's own).
export const removeDropOf = (idx, i, di) => mutSet(idx, i, row => isSideSet(row) ? removeSideDropAt(row, di) : removeDropAt(row, di))
export const removeBurstOf = (idx, i, ci) => mutSet(idx, i, row => {
  if (isSideSet(row)) return removeSideClusterAt(row, ci)
  const removed = clustersOf(row)[ci]?.r || 0
  return { ...removeClusterAt(row, ci), r: Math.max(0, (row.r || 0) - removed) }
})
export const setDropFieldAt = (idx, i, di, field, v, side) => mutSet(idx, i, row =>
  isSideSet(row) ? setSideDropAt(row, side, di, { [field]: v }) : setDropAt(row, di, { [field]: v }))
export const setBurstAt = (idx, i, ci, v, side) => mutSet(idx, i, row => {
  if (isSideSet(row)) return setSideClusterAt(row, side, ci, v)
  const delta = (Number(v) || 0) - (clustersOf(row)[ci]?.r || 0)
  return { ...setClusterAt(row, ci, { r: v }), r: Math.max(0, (row.r || 0) + delta) }
})

/* ---------- per-side fields (issue #60) ---------- */
// Patch one side of a unilateral row, keeping the row's aggregate (r/w/done/effort) in step via
// the model helper so every other reader stays right. The done tick goes through the hook's
// toggle instead, so ticking a side still fires the rest timer / auto-advance / complete flow.
export function setSideFieldAt(idx, i, side, field, v) {
  if (field !== 'w') return mutSet(idx, i, row => setSideField(row, side, field, v))
  update(s => {
    const e = s.active?.entries?.[idx]
    if (!e?.sets?.[i]) return
    const row = setSideField(e.sets[i], side, field, v)
    row.sides[side].weightOrigin = WEIGHT_ORIGIN_MANUAL
    e.sets[i] = row
    e.sets = cascadeWeight(e.sets, i, v, side, e.target?.backoffStep)
  })
}
/** One tap on a side's field. Reps step by one per side (each side is logged directly). */
export function stepSideFieldAt(idx, i, side, col, dir, { owned = null } = {}) {
  const cur = freshSet(idx, i)?.sides?.[side]?.[col.f] ?? 0
  if (col.f === 'w') return setSideFieldAt(idx, i, side, col.f, stepLoad(cur, col.step, dir, owned))
  const step = col.f === 'r' ? 1 : col.step
  return setSideFieldAt(idx, i, side, col.f, Math.max(0, Math.round(((cur || 0) + dir * step) * 100) / 100))
}
export const stepSideEffortAt = (idx, i, side, kind, field, dir) =>
  setSideFieldAt(idx, i, side, field, stepEffort(kind, freshSet(idx, i)?.sides?.[side]?.[field] ?? null, dir))

/* ---------- names the drawers code against ---------- */
export const copySetAt = (idx, i) => copyActiveSet(idx, i)
export const removeSetAt = (idx, i, opts) => deleteActiveSet(idx, i, opts)

/* ---------- the exercise and the order (new screen) ---------- */
export const UNDO_MS = 8000

/** Removes the exercise at once, with Undo for 8 s on the toast (W1.17). The old screen confirms
 *  first and calls removeActiveExercise. */
export function removeExerciseWithUndo(idx) {
  const A = activeNow()
  const entry = A?.entries?.[idx]
  if (!entry) return false
  const token = { activeId: A.id, idx, entry: structuredClone(entry), prev: A.entries[idx - 1]?.sg, next: A.entries[idx + 1]?.sg, wasCur: A.cur === idx }
  removeActiveExercise(idx)
  useUI.getState().toast(t('Removed {0}', exerciseNameFor(exOr(entry.id))), {
    action: t('Undo'), ms: UNDO_MS, onAction: () => undoRemoveExercise(token),
  })
  return true
}
/** Puts a removed exercise back at its place, in its superset when its partner is still beside it. */
export function undoRemoveExercise(token) {
  const A = activeNow()
  if (!A || A.id !== token.activeId) { useUI.getState().toast(t('Too late, that one’s gone')); return false }
  const at = Math.min(token.idx, A.entries.length)
  useUI.getState().shiftRestOwner?.(at, 1)
  update(s => {
    const entries = s.active.entries
    const entry = structuredClone(token.entry)
    entries.splice(at, 0, entry)
    if (entry.sg && entries[at - 1]?.id && token.prev === entry.sg) entries[at - 1].sg = entry.sg
    if (entry.sg && entries[at + 1]?.id && token.next === entry.sg) entries[at + 1].sg = entry.sg
    cleanupSg(entries)
    if (token.wasCur) s.active.cur = at
    else if (at <= s.active.cur) s.active.cur++
  })
  return true
}

/**
 * Moves the exercise (its superset with it) at `from` to where `to` is, one unit at a time, never
 * across a part: a warm-up stays among the warm-ups (lib/workout-parts.js). `cur` stays on the
 * exercise it was on. Returns the index the exercise landed on, or null when it could not move.
 */
export function moveEntryWithinPart(from, to) {
  let landed = null
  update(s => {
    const A = s.active
    const entry = A?.entries?.[from]
    if (!entry || to === from || to < 0 || to >= A.entries.length) return
    const part = partOf(entry)
    const dir = to > from ? 1 : -1
    const curEntry = A.entries[A.cur]
    let at = from
    for (let guard = 0; guard < A.entries.length; guard++) {
      const units = supersetUnits(A.entries)
      const unit = units.find(u => u.includes(at))
      const edge = dir > 0 ? unit[unit.length - 1] : unit[0]
      if (dir > 0 ? edge >= to : edge <= to) break
      const neighbour = A.entries[edge + dir]
      if (!neighbour || partOf(neighbour) !== part || !canMoveActiveWorkoutUnit(A, at, dir)) break
      moveActiveWorkoutUnit(A, at, dir)
      at = A.entries.indexOf(entry)
    }
    A.cur = Math.max(0, A.entries.indexOf(curEntry))
    if (at !== from) landed = at
  })
  return landed
}

/** Pairs the exercise with the next one as a superset, within its part. */
export function pairWithNext(idx) {
  const entries = activeNow()?.entries
  if (!entries?.[idx] || !entries[idx + 1] || partOf(entries[idx]) !== partOf(entries[idx + 1])) return false
  update(s => { s.active.entries = pairAdjacent(s.active.entries, idx, idx + 1) })
  return true
}
/** Takes the exercise out of its superset; a partner left alone stops being one. */
export function unpairAt(idx) {
  if (!activeNow()?.entries?.[idx]) return false
  update(s => { s.active.entries = unpairSuperset(s.active.entries, idx) })
  return true
}

/** The warm-up or the cool-down skipped for this session (`S.active.skipped`), or put back. */
export const setPartSkipped = (part, on = true) => update(s => {
  if (!s.active || (part !== 'warmup' && part !== 'cooldown')) return
  const skipped = { ...(s.active.skipped || {}) }
  if (on) skipped[part] = true
  else delete skipped[part]
  if (Object.keys(skipped).length) s.active.skipped = skipped
  else delete s.active.skipped
})
/** The warm-up or cool-down offer has been shown, so it never shows again this session. */
export const markOffered = part => update(s => {
  if (!s.active || (part !== 'warmup' && part !== 'cooldown')) return
  s.active.offered = { ...(s.active.offered || {}), [part]: true }
})

/**
 * Moves the exercise into another part ('warmup' | 'main' | 'cooldown') and re-sorts the session
 * so warm-ups stay first and cool-downs last. A superset does not span parts, so the exercise
 * leaves its superset. `cur` stays on the same entry, and a rest the moved entries started
 * follows them.
 */
export function setEntryPart(idx, part) {
  const A = activeNow()
  const entry = A?.entries?.[idx]
  if (!entry || !['warmup', 'main', 'cooldown'].includes(part) || partOf(entry) === part) return false
  let order = null
  update(s => {
    const list = s.active.entries
    const moved = list[idx]
    if (part === 'main') delete moved.part
    else moved.part = part
    if (moved.sg) {
      const rest = unpairSuperset(list, idx)
      rest.forEach((e, i) => { if (!e.sg) delete list[i].sg })
      cleanupSg(list)
    }
    const curEntry = list[s.active.cur]
    const sorted = normaliseParts(list)
    order = sorted.map(e => list.indexOf(e))
    s.active.entries = sorted
    s.active.cur = Math.max(0, s.active.entries.indexOf(curEntry))
  })
  const rest = useUI.getState().timer
  if (order && rest && rest.forIdx != null) {
    const to = order.indexOf(rest.forIdx)
    if (to >= 0 && to !== rest.forIdx) setUI({ timer: { ...rest, forIdx: to } })
  }
  return true
}
