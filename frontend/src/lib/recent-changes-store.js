// Where the change journal (lib/recent-changes.js) keeps its entries: this device only
// (localStorage), per profile like the phone's reminder log (lib/notifications/reminder-log.js),
// never in `S` and never synced. A signed-in account has its own key; a guest or local-only
// profile shares one fixed key.
//
// Best effort throughout: storage that is missing, full or holds something unreadable never
// throws into the caller. A value that cannot be parsed reads as an empty journal. A write that
// does not fit drops the oldest entries until it does; when even that fails the list is held in
// memory so the session still sees it, and the next write that lands replaces it.
//
// The journal is capped at MAX_ENTRIES entries and MAX_BYTES of serialised text, oldest dropped
// first (capEntries).
export const KEY_PREFIX = 'gains_recent_changes:'
export const MAX_ENTRIES = 60
export const MAX_BYTES = 1000000

// Whose journal it is: the store hands over its signed-in user (it cannot be imported from here,
// as the store imports this file). No owner yet, or signed out, is 'guest'.
let ownerOf = () => null
export const setChangesOwner = fn => { ownerOf = fn }
const profileOf = user => (user ? 'u' + String(user.id ?? user.name ?? '') : 'guest')
// `user` is a signed-in user ({ id }), null for the guest profile; left out, the current profile.
export const changesKey = (user = ownerOf()) => KEY_PREFIX + profileOf(user)

const storage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

// Lists a write could not land, by key.
const held = new Map()

const isEntry = e => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.kind === 'string' &&
  Number.isFinite(e.at) && (e.state === 'open' || e.state === 'restored')

/** The newest MAX_ENTRIES entries that fit in MAX_BYTES, newest first. Pure. */
export function capEntries(entries) {
  const sorted = (Array.isArray(entries) ? entries : []).filter(isEntry).sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES)
  const kept = []
  let bytes = 2
  for (const e of sorted) {
    const size = JSON.stringify(e).length + 1
    if (bytes + size > MAX_BYTES) break
    kept.push(e)
    bytes += size
  }
  return kept
}

/** The stored journal, newest first; [] when there is none or it is unreadable. */
export function readEntries() {
  const key = changesKey()
  if (held.has(key)) return held.get(key)
  try {
    const parsed = JSON.parse(storage()?.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry).sort((a, b) => b.at - a.at) : []
  } catch { return [] }
}

/** Stores `entries` (capped), best effort. Returns whether they reached storage. */
export function writeEntries(entries) {
  const key = changesKey()
  let list = capEntries(entries)
  const store = storage()
  for (let tries = 0; tries < 6; tries++) {
    try {
      if (!store) break
      if (list.length) store.setItem(key, JSON.stringify(list)); else store.removeItem(key)
      held.delete(key)
      return true
    } catch {
      if (list.length <= 1) { list = []; continue }
      list = list.slice(0, Math.floor(list.length / 2))
    }
  }
  held.set(key, capEntries(entries))
  return false
}

/** Forgets a profile's journal (the current one when `user` is left out). */
export function removeEntries(user) {
  const key = user === undefined ? changesKey() : changesKey(user)
  held.delete(key)
  try { storage()?.removeItem(key) } catch { /* nothing to take out */ }
}
