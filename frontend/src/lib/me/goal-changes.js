// Journal kind `goal-change`: a change made on My goal (goal, target weight, body details, daily
// movement, daily targets, or Keep my weight).
//
//   snapshot: { settings: { order, before, after } | null, targetW: { before, after } | null }
//             settings  the NutriTrace settings written, in the order they were written, with the
//                       value each had before (null: not set) and the value written
//             targetW   `S.targetW` before and after, in `unit` (the display unit then; converted on restore)
//   subject:  ''        facts: { what: 'goal' | 'target' | 'body' | 'movement' | 'targets', from, to, unit? }
//                       goal: 'lose' | 'keep' | 'build' | null; target: weight in `unit` or null;
//                       body: { heightCm, birthYear, sex }; movement: a level;
//                       targets: { calories, proteinG, carbsG, fatG }
//
// Restore (and the toast's Undo, which is the same call) puts the `before` values back, in the
// order they were written, but only while every key still holds what the change wrote: a value
// changed since (here or on another device) answers 'changed' and nothing is touched, so a restore
// never reverts a newer edit. Undoing a restore does the same the other way round.
import { nutritionAvailable } from '../nutrition/api.js'
import { useNutrition } from '../nutrition/store.js'
import { registerRestorer, recordChange } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'
import { convertBodyWeight } from '../units.js'
import { applyWrites } from './goal-writes.js'

export const GOAL_CHANGE = 'goal-change'

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Builds the journal snapshot from a successful `applyWrites` result and the target weight change. */
export function snapshotOf(written, targetW = null) {
  const settings = written && written.order.length
    ? { order: [...written.order], before: written.before, after: written.after }
    : null
  // The unit the weights were in: Settings > Units converts S.targetW, so a restore converts these.
  const unit = useStore.getState().S.unit === 'lb' ? 'lb' : 'kg'
  return { settings, targetW: targetW && !same(targetW.before, targetW.after) ? { ...targetW, unit } : null }
}

/** Journals one change; returns the entry id or null. */
export function recordGoalChange(what, from, to, snapshot, extra = {}) {
  return recordChange({ kind: GOAL_CHANGE, subject: null, facts: { what, from, to, ...extra }, snapshot })
}

/**
 * Applies a snapshot one way: `direction` 'restore' puts `before` back (expecting `after`),
 * 'undo' puts `after` back (expecting `before`). { ok: true } or { ok: false, reason }:
 * 'gone' (no settings store), 'changed', 'error' (a write failed; what was written is put back).
 */
export async function applySnapshot(snap, direction = 'restore') {
  if (!snap || (!snap.settings && !snap.targetW)) return { ok: false, reason: 'gone' }
  const from = direction === 'restore' ? 'after' : 'before'
  const to = direction === 'restore' ? 'before' : 'after'
  const st = snap.settings
  if (st) {
    if (!nutritionAvailable(useStore.getState().user)) return { ok: false, reason: 'gone' }
    const data = await useNutrition.getState().loadSettings({ force: true })
    if (useNutrition.getState().settings.status === 'error' || !data) return { ok: false, reason: 'error' }
    if (!st.order.every(key => same(data[key], st[from][key]))) return { ok: false, reason: 'changed' }
  }
  const tw = snap.targetW
  const nowUnit = useStore.getState().S.unit === 'lb' ? 'lb' : 'kg'
  const inNow = v => (tw?.unit && tw.unit !== nowUnit && v != null ? convertBodyWeight(v, tw.unit, nowUnit) : v)
  if (tw && !same(useStore.getState().S.targetW, inNow(tw[from]))) return { ok: false, reason: 'changed' }
  if (st) {
    const res = await applyWrites(st.order.map(key => [key, st[to][key] ?? null]))
    if (!res.ok) return { ok: false, reason: 'error' }
  }
  if (tw) useStore.getState().update(s => { s.targetW = inNow(tw[to]) })
  return { ok: true }
}

registerRestorer(GOAL_CHANGE, {
  restore: snap => applySnapshot(snap, 'restore'),
  undo: snap => applySnapshot(snap, 'undo'),
})
