// Journal kinds `weighin-edit` and `weighin-delete` (Me > Recent changes): a weigh-in whose value was
// changed in the Body page's Edit weigh-in drawer, and one deleted there. No UI imports.
//
//   weighin-edit    snapshot { before: { d, w, t? }, after: w }   facts { from, to, unit }
//   weighin-delete  snapshot { before: { d, w, t? } }             facts { weight, unit }
//
// One weigh-in a day. A restore puts the old reading back only while the day is still as the change
// left it: a delete is restored when the day has no weigh-in (a newer one for that day answers
// `replaced`, never a second reading), an edit while the day still holds the value the edit saved
// (anything else answers `replaced`, a day that has lost its weigh-in `gone`). The restored entry
// is stamped now, so the sync takes it over the older copy and the tombstone.
import { recordChange, registerRestorer } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'
import { setBack, weighInOn } from './weigh-in.js'
import { syncNow } from '../nutrition/sync.js'

export const WEIGHIN_EDIT = 'weighin-edit'
export const WEIGHIN_DELETE = 'weighin-delete'

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

/** Journals a weigh-in whose value changed. `before` is the entry as it was, `w` the value saved. */
export function recordWeighInEdit(before, w, unit) {
  if (!before?.d) return null
  return recordChange({
    kind: WEIGHIN_EDIT, day: before.d, subject: '',
    facts: { from: before.w, to: w, unit }, snapshot: { before: clone(before), after: w },
  })
}

/** Journals a deleted weigh-in. */
export function recordWeighInDelete(before, unit) {
  if (!before?.d) return null
  return recordChange({
    kind: WEIGHIN_DELETE, day: before.d, subject: '',
    facts: { weight: before.w, unit }, snapshot: { before: clone(before) },
  })
}

function apply(day, entry) {
  useStore.getState().update(s => setBack(s, day, entry))
  void syncNow()
}

export function restoreWeighInDelete(snap) {
  const before = snap?.before
  if (!before?.d || !(Number(before.w) > 0)) return { ok: false, reason: 'gone' }
  if (weighInOn(useStore.getState().S, before.d)) return { ok: false, reason: 'replaced' }
  apply(before.d, before)
  return { ok: true, where: { day: before.d } }
}

/** Takes the restored weigh-in out again. */
export function undoWeighInDeleteRestore(snap) {
  const before = snap?.before
  if (!before?.d) return { ok: false }
  const now = weighInOn(useStore.getState().S, before.d)
  if (!now || now.w !== before.w) return { ok: false }
  apply(before.d, null)
  return { ok: true }
}

export function restoreWeighInEdit(snap) {
  const before = snap?.before
  if (!before?.d || !(Number(before.w) > 0)) return { ok: false, reason: 'gone' }
  const now = weighInOn(useStore.getState().S, before.d)
  if (!now) return { ok: false, reason: 'gone' }
  // Already back, or changed again since: not this change's to undo.
  if (now.w === before.w || now.w !== snap.after) return { ok: false, reason: 'replaced' }
  apply(before.d, before)
  return { ok: true, where: { day: before.d } }
}

/** Puts the value the edit saved back. */
export function undoWeighInEditRestore(snap) {
  const before = snap?.before
  if (!before?.d) return { ok: false }
  const now = weighInOn(useStore.getState().S, before.d)
  if (!now || now.w !== before.w) return { ok: false }
  apply(before.d, { ...now, w: snap.after })
  return { ok: true }
}

registerRestorer(WEIGHIN_DELETE, { restore: restoreWeighInDelete, undo: undoWeighInDeleteRestore })
registerRestorer(WEIGHIN_EDIT, { restore: restoreWeighInEdit, undo: undoWeighInEditRestore })
