import { isMockFriends } from './store.js'

// When this person last hid or opened the Today Friends card, as a time in ms, per person on this
// device (localStorage, in try/catch). The card shows again only for a moment newer than this, so
// Hide is "until something new happens" and never "off" (that is Turn off Friends). The page keeps
// its own copy too, so Hide works in a private window where storage throws. The gallery's mock
// uses a separate in-memory mark and never touches real storage.

const KEY = 'gains_friends_card_seen'
const keyOf = uid => KEY + ':' + uid

const session = new Map()
let mockSeen = 0
const listeners = new Set()

export function readCardSeen(uid) {
  if (isMockFriends()) return mockSeen
  let stored = 0
  try {
    const n = Number(localStorage.getItem(keyOf(uid)))
    if (Number.isFinite(n)) stored = n
  } catch { /* no storage: the session copy answers */ }
  return Math.max(stored, session.get(uid) || 0)
}

/** Marks everything up to `at` as seen. It only moves forward, so a late call never brings a moment back. */
export function markCardSeen(uid, at = Date.now()) {
  if (!(at > readCardSeen(uid))) return
  if (isMockFriends()) mockSeen = at
  else {
    session.set(uid, at)
    try { localStorage.setItem(keyOf(uid), String(at)) } catch { /* the session copy holds it */ }
  }
  listeners.forEach(fn => fn())
}

export function subscribeCardSeen(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Puts the in-memory marks back to nothing (the gallery's and the tests' seam). */
export function __resetCardSeen() {
  mockSeen = 0
  session.clear()
  listeners.forEach(fn => fn())
}
