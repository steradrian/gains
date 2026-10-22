// The Coach's applied plan edits, kept as stamps for the notifications feed (feed.js `coach`).
//
// `S.coach.planChanges` is an append-only list written at the moment a change is applied
// (lib/coach.js applyChangeSet, applyCreatedPlan), with the routine names resolved then so a line
// survives a later rename or delete. It is never back-filled: an older change has no stamp and no
// notification.
//
//   { id, at, type, weekday?, routineName?, from?, to?, reverted? }
//   id        `<proposalId>:<changeId>` (`<proposalId>:plan` for a created plan): the same change
//             is the same stamp however often it is applied, recomputed or synced.
//   type      'week' (weekday + routineName; no routineName: a rest day), 'add-routine' and
//             'remove-routine' (routineName), 'rename-routine' (from, to), 'create' (a new plan).
//   reverted  set by revertLast instead of deleting the stamp: a deleted stamp would come back from
//             the other device's copy at the next sync, a tombstone merges (mergePlanChanges).
//
// Sync: `coach` is one slice stamped as a whole (`edited.coach`), so the newer copy would replace
// the other's list. mergeStates (lib/sync-merge.js) therefore merges this list on its own: the
// union by id, a tombstone from either side kept, newest PLAN_CHANGE_MAX kept.

export const PLAN_CHANGE_DAYS = 30   // the feed's window (notifications/feed.js FEED_DAYS)
export const PLAN_CHANGE_MAX = 100
const DAY_MS = 86400000
const NAME_MAX = 80
const TYPES = ['week', 'add-routine', 'remove-routine', 'rename-routine', 'create']

const text = v => (typeof v === 'string' && v.trim() ? v.slice(0, NAME_MAX) : null)

/** The stamp for one applied change, or null when the change is not a weekday or routine edit (or
 *  the stamp could not name what it did). `prior` is the changed routine's name before the apply. */
export function planChangeOf(s, change, { proposalId, at, prior }) {
  if (!proposalId || !change?.id) return null
  const id = `${proposalId}:${change.id}`
  switch (change.type) {
    case 'week': {
      const weekday = change.target?.weekday
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null
      if (change.after == null || change.after === 'rest') return { id, at, type: 'week', weekday }
      const name = text((s.routines || []).find(r => r.id === change.after)?.name)
      return name ? { id, at, type: 'week', weekday, routineName: name } : null
    }
    case 'add-routine': {
      const routineName = text(change.after?.name)
      return routineName ? { id, at, type: 'add-routine', routineName } : null
    }
    case 'remove-routine': {
      const routineName = text(prior)
      return routineName ? { id, at, type: 'remove-routine', routineName } : null
    }
    case 'rename-routine': {
      const from = text(prior), to = text(change.after)
      return from && to ? { id, at, type: 'rename-routine', from, to } : null
    }
    default: return null
  }
}

/** A stamp as a list may hold it (it came off the wire): the known shape, or null. */
export function cleanPlanChange(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || !Number.isFinite(x.at) || !TYPES.includes(x.type)) return null
  const out = { id: x.id, at: x.at, type: x.type }
  if (x.type === 'week') {
    if (!Number.isInteger(x.weekday) || x.weekday < 0 || x.weekday > 6) return null
    out.weekday = x.weekday
    const routineName = text(x.routineName)
    if (routineName) out.routineName = routineName
  } else if (x.type === 'add-routine' || x.type === 'remove-routine') {
    out.routineName = text(x.routineName)
    if (!out.routineName) return null
  } else if (x.type === 'rename-routine') {
    out.from = text(x.from)
    out.to = text(x.to)
    if (!out.from || !out.to) return null
  }
  if (x.reverted === true) out.reverted = true
  return out
}

const byAt = (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** The union of two lists by id, sorted by `at`, the newest PLAN_CHANGE_MAX kept. Of an id both
 *  have, the first list's stamp, reverted when either is. */
export function mergePlanChanges(a, b) {
  const byId = new Map()
  for (const x of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const c = cleanPlanChange(x)
    if (!c) continue
    const had = byId.get(c.id)
    if (!had) byId.set(c.id, c)
    else if (c.reverted) had.reverted = true
  }
  return [...byId.values()].sort(byAt).slice(-PLAN_CHANGE_MAX)
}

/** Writes `stamps` into the coach slice `c`: a new id is appended, an id already there is left
 *  alone (a repeat apply adds nothing) unless it was reverted, which a fresh apply undoes. Stamps
 *  older than the window are dropped, and the list is capped. */
export function addPlanChanges(c, stamps, now) {
  const kept = new Map((Array.isArray(c.planChanges) ? c.planChanges : []).map(x => [x?.id, x]))
  for (const st of stamps) {
    const had = kept.get(st.id)
    if (!had || had.reverted) kept.set(st.id, st)
  }
  const from = now - PLAN_CHANGE_DAYS * DAY_MS
  c.planChanges = mergePlanChanges([...kept.values()].filter(x => x?.at >= from), [])
}

/** Marks the stamps of `proposalId` reverted (an undone change leaves no notification). */
export function revertPlanChanges(c, proposalId) {
  if (!proposalId || !Array.isArray(c.planChanges)) return
  const prefix = `${proposalId}:`
  c.planChanges = c.planChanges.map(x => (typeof x?.id === 'string' && x.id.startsWith(prefix) ? { ...x, reverted: true } : x))
}
