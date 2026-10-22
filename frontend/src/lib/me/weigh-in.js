// Weigh-in writes shared by the Log weight drawer (sheets/body-weight.jsx) and the Body page's
// Edit weigh-in drawer (views/me/body/weigh-in-drawers.jsx). No UI imports.
//
// S.bodyweight = [{ d: 'YYYY-MM-DD', w, t? }], one entry per day, `w` in the person's display unit.
// `t` is when the entry was last written, the sync's change stamp (lib/sync-merge.js stampChange);
// charts place an entry by its day. Removing an entry records the tombstone in S.deleted.bodyweight
// by itself (the store's update, stampDeletions), and putting one back after that is stamped as an
// add-back, so the sync keeps it.
import { syncNow } from '../nutrition/sync.js'
import { useStore } from '../../store/useStore.js'

const byDay = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)

/** The entry for `day` in state `S`, or null. */
export const weighInOn = (S, day) => (Array.isArray(S?.bodyweight) ? S.bodyweight.find(b => b.d === day) : null) || null

/** Sets `day` to `w` in the draft `s` (one per day, stamped now). Returns the entry it replaced, or null. */
export function putWeighIn(s, day, w, now = Date.now()) {
  const ex = s.bodyweight.find(b => b.d === day)
  const before = ex ? { ...ex } : null
  if (ex) { ex.w = w; ex.t = now } else s.bodyweight.push({ d: day, w, t: now })
  s.bodyweight.sort(byDay)
  return before
}

/** Takes `day` out of the draft `s`. Returns the entry it removed, or null. */
export function dropWeighIn(s, day) {
  const ex = s.bodyweight.find(b => b.d === day)
  s.bodyweight = s.bodyweight.filter(b => b.d !== day)
  return ex ? { ...ex } : null
}

/** In the draft `s`, `day` goes back to `before` (stamped now so the sync takes it), or goes when `before` is null. */
export function setBack(s, day, before, now = Date.now()) {
  s.bodyweight = s.bodyweight.filter(b => b.d !== day)
  if (before) {
    s.bodyweight.push({ ...before, t: now })
    s.bodyweight.sort(byDay)
  }
}

/** Saves `w` as `day`'s weigh-in in the store. Returns the entry it replaced, or null. */
export function saveWeighIn(day, w) {
  let before = null
  useStore.getState().update(s => { before = putWeighIn(s, day, w) })
  void syncNow()
  return before
}

/** Deletes `day`'s weigh-in from the store. Returns the entry removed, or null. */
export function deleteWeighIn(day) {
  let removed = null
  useStore.getState().update(s => { removed = dropWeighIn(s, day) })
  void syncNow()
  return removed
}

/**
 * Undo of a saved or deleted weigh-in: the day's entry goes, or gets back what it had. `left` is what
 * the action left on the day (the saved weight, or null after a delete). Only while the day still
 * holds that: a newer reading (another device's sync, a second Log) is never overwritten.
 * Returns whether it undid.
 */
export function undoWeighIn(day, before, left) {
  const now = weighInOn(useStore.getState().S, day)
  if (left == null ? now : now?.w !== left) return false
  useStore.getState().update(s => setBack(s, day, before))
  void syncNow()
  return true
}

/**
 * When an entry was logged, if that can be told: `{ day, time }` for an entry written on its own
 * day. Its `t` is also re-stamped by edits and sync, so a stamp from another day says nothing
 * about when the person weighed in and gives null.
 */
export function loggedAt(entry) {
  const t = Number(entry?.t)
  if (!Number.isFinite(t) || t <= 0) return null
  const at = new Date(t)
  const pad = n => String(n).padStart(2, '0')
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return day === entry.d ? { day, time: at } : null
}
