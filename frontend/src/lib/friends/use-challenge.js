// One challenge, live: GET /groups/{id}/challenges/{cid} kept in memory per challenge, with Count
// me in and Leave.
//
// Same rules as the groups caches (store.js, use-group.js): online-only, nothing in storage,
// refetch on mount, on focus and every 60 s while a screen shows it, and after every write. A write
// is awaited before the page changes (the answer is the new challenge), so a refused one changes
// nothing and the caller toasts it. `gone`: a 404 means the person is no longer in the group, and
// the screen leaves instead of staying stale.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { friendsAvailable, getChallenge, isOffline, joinChallenge as joinRequest, leaveChallenge as leaveRequest } from './api.js'

export const REFRESH_MS = 60000

/** @typedef {{ challenge: object|null, status: 'idle'|'loading'|'ready'|'gone'|'error', stale: boolean, offline: boolean }} ChallengeSnapshot */

const EMPTY = Object.freeze({ challenge: null, status: 'idle', stale: false, offline: false })

const entries = new Map()   // `${gid}|${cid}` -> { snap, watchers, timer, inflight, epoch }
const listeners = new Set()
let mocked = false

const keyOf = (gid, cid) => gid + '|' + cid

const entryOf = key => {
  let e = entries.get(key)
  if (!e) { e = { snap: EMPTY, watchers: 0, timer: null, inflight: null, epoch: 0 }; entries.set(key, e) }
  return e
}

const put = (key, next) => {
  const e = entryOf(key)
  e.snap = { ...e.snap, ...next }
  listeners.forEach(fn => fn())
}

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
const snapshotOf = key => entries.get(key)?.snap ?? EMPTY

/** The challenge's current snapshot outside React (the tests read it). */
export const challengeSnapshot = (gid, cid) => snapshotOf(keyOf(gid, cid))

/** A challenge answer with every list the page maps over present. */
const normalize = c => ({ ...c, joined: c.joined || [], invited: c.invited || [], you: c.you || { in: false } })

async function load(gid, cid) {
  const key = keyOf(gid, cid)
  const e = entryOf(key)
  if (mocked || !friendsAvailable()) return
  if (e.inflight) return e.inflight
  if (!e.snap.challenge) put(key, { status: 'loading' })
  const epoch = e.epoch
  const run = getChallenge(gid, cid)
    .then(raw => {
      // A write landed while this was out: its answer predates the write, so it stands aside.
      if (e.inflight !== run || e.epoch !== epoch) return
      put(key, { challenge: normalize(raw), status: 'ready', stale: false, offline: false })
    })
    .catch(err => {
      if (e.inflight !== run) return
      if (err?.code === 'not-found') { put(key, { status: 'gone', challenge: null }); return }
      put(key, { status: e.snap.challenge ? 'ready' : 'error', stale: !!e.snap.challenge, offline: isOffline(err) })
    })
    .finally(() => { if (e.inflight === run) e.inflight = null })
  e.inflight = run
  return run
}

const reload = (gid, cid) => { entryOf(keyOf(gid, cid)).inflight = null; return load(gid, cid) }

const onFocus = () => {
  if (document.visibilityState === 'hidden') return
  entries.forEach(e => { if (e.watchers > 0) load(e.gid, e.cid) })
}
let focusBound = false

/** A screen shows the challenge: fetch now, on focus and every 60 s until the last one goes. Returns the stop function. */
export function watchChallenge(gid, cid) {
  const key = keyOf(gid, cid)
  const e = entryOf(key)
  e.gid = gid
  e.cid = cid
  e.watchers++
  if (e.watchers === 1) e.timer = setInterval(() => load(gid, cid), REFRESH_MS)
  if (!focusBound) {
    focusBound = true
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
  }
  load(gid, cid)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    e.watchers--
    if (e.watchers === 0) { clearInterval(e.timer); e.timer = null }
  }
}

// Sends the write, shows the challenge it answers with at once, then refetches. A refused write
// throws a FriendsError and leaves the cache as it was.
async function write(gid, cid, request, patch) {
  const key = keyOf(gid, cid)
  const e = entryOf(key)
  if (mocked) {
    if (e.snap.challenge) put(key, { challenge: patch(e.snap.challenge) })
    return
  }
  const answer = await request(gid, cid)
  e.epoch++
  if (answer && typeof answer === 'object' && answer.id) put(key, { challenge: normalize(answer), status: 'ready' })
  reload(gid, cid)
}

// Local stand-in for the answer in the gallery: the person in or out, nothing else changed.
const asIn = value => c => ({ ...c, you: { ...c.you, in: value } })

/** Count me in: the person's finished work counts toward the shared bar from now on. */
export const joinThisChallenge = (gid, cid) => write(gid, cid, joinRequest, asIn(true))

/** Leave: only this person's count comes off the bar (the server removes it); nothing else changes. */
export const leaveThisChallenge = (gid, cid) => write(gid, cid, leaveRequest, asIn(false))

/**
 * `{ challenge, status, stale, offline, joinChallenge, leaveChallenge }`. The two writes resolve
 * when the server has answered and throw a FriendsError for the caller to toast.
 */
export function useChallenge(groupId, cid) {
  useEffect(() => (groupId && cid && friendsAvailable() ? watchChallenge(groupId, cid) : undefined), [groupId, cid])
  const key = keyOf(groupId, cid)
  const snap = useSyncExternalStore(subscribe, () => snapshotOf(key), () => snapshotOf(key))
  const actions = useMemo(() => ({
    joinChallenge: () => joinThisChallenge(groupId, cid),
    leaveChallenge: () => leaveThisChallenge(groupId, cid),
  }), [groupId, cid])
  return { ...snap, ...actions }
}

/** Forgets every challenge: another account signed in, or the tests starting over. */
export function resetChallenges() {
  entries.forEach(e => clearInterval(e.timer))
  entries.clear()
  listeners.forEach(fn => fn())
}

/**
 * The gallery's and the tests' seam: shows `challenge` without any network and keeps every write
 * local. Returns the function that puts the real cache back.
 */
export function __setMockChallenge(gid, cid, challenge, { status = 'ready' } = {}) {
  const key = keyOf(gid, cid)
  const before = entries.get(key)
  const was = mocked
  mocked = true
  entries.set(key, { gid, cid, snap: { challenge: challenge ? normalize(challenge) : null, status, stale: false, offline: false }, watchers: before?.watchers ?? 0, timer: before?.timer ?? null, inflight: null, epoch: 0 })
  listeners.forEach(fn => fn())
  return () => {
    mocked = was
    if (before) entries.set(key, before)
    else entries.delete(key)
    listeners.forEach(fn => fn())
  }
}
