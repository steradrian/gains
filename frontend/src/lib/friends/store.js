// The Friends cache: the last answers of GET /me and GET /groups, in memory, with subscribe.
//
// Friends is online-only (shared decision 6): a screen shows what it last loaded and says so when
// it cannot reach the server (`stale`), and a write that fails is toasted by the caller. Nothing is
// written to storage, so a signed-out device or another account never sees this one's groups.
// Refresh (decision 7): on mount, when the app comes back to the front, and every 60 s while a
// Friends screen is mounted; a write refetches on success. No sockets.
import { useStore } from '../../store/useStore.js'
import { FriendsError, getGroups, getMe, isMissing, isOffline, setAvailableOverride, setServerMissing } from './api.js'

export const REFRESH_MS = 60000

/** @typedef {{ me: import('./api.js').FriendsMe|null, groups: import('./api.js').GroupSummary[]|null,
 *   status: 'idle'|'loading'|'ready'|'unavailable', stale: boolean, offline: boolean }} FriendsSnapshot */

const EMPTY = { me: null, groups: null, status: 'idle', stale: false, offline: false }

let snap = EMPTY
let owner = null
let mocked = false
let inflight = null
const listeners = new Set()

const set = next => {
  snap = { ...snap, ...next }
  listeners.forEach(fn => fn())
}

const ownerOf = () => {
  const u = useStore.getState().user
  return u ? String(u.id ?? u.name ?? '') : null
}

/** The current snapshot; a new object whenever anything changed (useSyncExternalStore reads this). */
export const getFriends = () => snap

export function subscribeFriends(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Forgets everything: another account signed in on this device, or Friends turned unavailable. */
export function resetFriends() {
  inflight = null
  setServerMissing(false)
  snap = EMPTY
  listeners.forEach(fn => fn())
}

/**
 * Fetches /me and /groups together. A failure keeps what was cached and marks it `stale`; an
 * answer that says this server has no Friends (or no session) makes Friends unavailable. One
 * request at a time: a second call while one is out gets the same promise.
 */
export function refreshFriends() {
  if (mocked) return Promise.resolve()
  const who = ownerOf()
  if (who !== owner) { resetFriends(); owner = who }
  if (!who) return Promise.resolve()
  if (inflight) return inflight
  if (!snap.me) set({ status: 'loading' })
  const run = Promise.all([getMe(), getGroups()])
    .then(([me, groups]) => {
      if (inflight !== run) return
      // Someone else's JSON (a proxy's page, a server without Friends) is not an answer.
      if (typeof me?.on !== 'boolean' || !Array.isArray(groups)) throw new FriendsError('Not Friends data', { code: 'bad-response' })
      setServerMissing(false)
      set({ me, groups, status: 'ready', stale: false, offline: false })
    })
    .catch(e => {
      if (inflight !== run) return
      if (isMissing(e) && !snap.me) {
        setServerMissing(true)
        set({ status: 'unavailable', stale: false, offline: false })
        return
      }
      set({ status: snap.me ? 'ready' : 'idle', stale: !!snap.me, offline: isOffline(e) })
    })
    .finally(() => { if (inflight === run) inflight = null })
  inflight = run
  return run
}

/** Puts an answer a write returned (PUT /me) straight into the cache, before the refetch lands. */
export function cacheMe(me) {
  if (!mocked) set({ me, status: 'ready', stale: false })
}

let watchers = 0
let timer = null

const onFocus = () => { if (document.visibilityState !== 'hidden') refreshFriends() }

/**
 * A Friends screen is on show: refetch now, on focus and every 60 s until the last one goes.
 * Returns the function that stops watching.
 */
export function watchFriends() {
  watchers++
  if (watchers === 1) {
    timer = setInterval(refreshFriends, REFRESH_MS)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
  }
  refreshFriends()
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    watchers--
    if (watchers === 0) {
      clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }
}

/**
 * The gallery's and the tests' seam: shows `me` and `groups` without any network, and keeps every
 * refresh quiet while it is installed. Returns the function that puts the real cache back.
 */
export function __setMockFriends({ me = null, groups = [] } = {}) {
  const before = { snap, owner, inflight }
  mocked = true
  inflight = null
  setAvailableOverride(true)
  set({ me, groups, status: 'ready', stale: false, offline: false })
  return () => {
    mocked = false
    setAvailableOverride(null)
    inflight = before.inflight
    owner = before.owner
    snap = before.snap
    listeners.forEach(fn => fn())
  }
}

/** True while the gallery's or a test's mock is installed: nothing may be written to real storage. */
export const isMockFriends = () => mocked

/** A mocked cache that is told the server is out of reach, for the offline state. */
export function __setMockStale() {
  if (mocked) set({ stale: true, offline: true })
}
