// One group, live: GET /groups/{id} kept in memory per group, with the writes the Group page makes.
//
// Same rules as the groups cache (store.js): online-only, nothing in storage, refetch on mount, on
// focus and every 60 s while a screen shows the group, and on success of every write. Added here:
//  - a high-water mark per (group, week, member) so a refetch never lowers done work (shared
//    decision 5, belt and braces with the server's own mark);
//  - optimistic writes (cheer, mute, remove a moment) that put the previous group back exactly if
//    the request fails or the person taps Undo, and make an answer that was already in flight
//    before the write stand aside instead of undoing it;
//  - `gone`: a 404 `not-found` means the person is no longer in the group (left elsewhere,
//    removed, group deleted) and the screen leaves, never a stale page.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { todayISO, weekKey } from '../format.js'
import {
  friendsAvailable, getGroup, isOffline, leaveGroup as leaveRequest, removeMoment as removeMomentRequest,
  sendCheer, setGroupPrefs, setMute, undoCheer,
} from './api.js'
import { refreshFriends } from './store.js'

export const REFRESH_MS = 60000

/** @typedef {{ group: object|null, status: 'idle'|'loading'|'ready'|'gone'|'left'|'error', stale: boolean, offline: boolean }} GroupSnapshot */

const EMPTY = Object.freeze({ group: null, status: 'idle', stale: false, offline: false })

const entries = new Map()   // id -> { snap, watchers, timer, inflight, epoch }
const marks = new Map()     // `${id}|${week}|${uid or member signature}` -> highest done seen
const listeners = new Set()
let mocked = false

const entryOf = id => {
  let e = entries.get(id)
  if (!e) { e = { snap: EMPTY, watchers: 0, timer: null, inflight: null, epoch: 0 }; entries.set(id, e) }
  return e
}

const put = (id, next) => {
  const e = entryOf(id)
  e.snap = { ...e.snap, ...next }
  listeners.forEach(fn => fn())
}

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
const snapshotOf = id => entries.get(id)?.snap ?? EMPTY

/** The group's current snapshot outside React (the tests read it). */
export const groupSnapshot = snapshotOf

/** A group answer with every list the page maps over present. */
const normalize = g => ({
  ...g,
  members: g.members || [],
  moments: g.moments || [],
  weekDays: g.weekDays || [],
  challenges: g.challenges || [],
  week: g.week || { done: 0, planned: 0 },
})

/**
 * Raises each member's `done`, and the week's total, to the highest this client has seen for that
 * week: a plan edit or a deleted workout may lower what the server says, never what the ring shows.
 * The total's mark is keyed by who is in the group, so a member leaving (a real drop) is not held up.
 */
export function applyHighWater(id, group, week = weekKey(todayISO())) {
  const raise = (who, done) => {
    const key = id + '|' + week + '|' + who
    const best = Math.max(marks.get(key) ?? 0, Number(done) || 0)
    marks.set(key, best)
    return best
  }
  const signature = '*' + group.members.map(m => m.uid).join(',')
  return {
    ...group,
    members: group.members.map(m => ({ ...m, done: raise(m.uid, m.done) })),
    week: { ...group.week, done: raise(signature, group.week.done) },
  }
}

async function load(id) {
  const e = entryOf(id)
  if (mocked || !friendsAvailable()) return
  if (e.inflight) return e.inflight
  if (!e.snap.group) put(id, { status: 'loading' })
  const epoch = e.epoch
  const run = getGroup(id)
    .then(raw => {
      // A write landed while this was out: its answer predates the write, so it is dropped (the
      // write refetches itself when it settles).
      if (e.inflight !== run || e.epoch !== epoch || e.snap.status === 'left') return
      put(id, { group: applyHighWater(id, normalize(raw)), status: 'ready', stale: false, offline: false })
    })
    .catch(err => {
      if (e.inflight !== run || e.snap.status === 'left') return
      if (err?.code === 'not-found') { put(id, { status: 'gone', group: null }); return }
      put(id, { status: e.snap.group ? 'ready' : 'error', stale: !!e.snap.group, offline: isOffline(err) })
    })
    .finally(() => { if (e.inflight === run) e.inflight = null })
  e.inflight = run
  return run
}

const reload = id => { entryOf(id).inflight = null; return load(id) }

const onFocus = () => { if (document.visibilityState !== 'hidden') entries.forEach((e, id) => { if (e.watchers > 0) load(id) }) }
let focusBound = false

/** A screen shows group `id`: fetch now, on focus and every 60 s until the last one goes. Returns the stop function. */
export function watchGroup(id) {
  const e = entryOf(id)
  e.watchers++
  if (e.watchers === 1) e.timer = setInterval(() => load(id), REFRESH_MS)
  if (!focusBound) {
    focusBound = true
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
  }
  load(id)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    e.watchers--
    if (e.watchers === 0) { clearInterval(e.timer); e.timer = null }
  }
}

/** Replaces the group in the cache with `fn(group)`; returns the group as it was, for the way back. */
function change(id, fn) {
  const e = entryOf(id)
  const before = e.snap.group
  if (!before) return null
  e.epoch++
  put(id, { group: fn(before) })
  return before
}

const putBack = (id, group) => { if (group) change(id, () => group) }

const withMoment = (id, mid, patch) => change(id, g => ({ ...g, moments: g.moments.map(m => (m.id === mid ? { ...m, ...patch } : m)) }))

/** Cheers a moment: the pill turns at once; a refused request puts it back and throws. */
export async function cheerMoment(id, mid) {
  const before = withMoment(id, mid, { cheered: true })
  try {
    if (!mocked) await sendCheer({ group: id, kind: 'moment', ref: mid })
  } catch (e) {
    putBack(id, before)
    throw e
  }
  reload(id)
}

/** Takes a cheer back (the toast's Undo): the pill is a Cheer again; a refused request puts "Cheered" back and throws. */
export async function uncheerMoment(id, mid) {
  const before = withMoment(id, mid, { cheered: false })
  try {
    if (!mocked) await undoCheer({ group: id, kind: 'moment', ref: mid })
  } catch (e) {
    putBack(id, before)
    throw e
  }
  reload(id)
}

/**
 * Mutes or unmutes a member for this viewer only. Muting hides their moments at once (the server
 * leaves them out of the next answer too); `restore` is the group as it was before a mute, for an
 * Undo to put back exactly, moments and all. Resolves to that previous group.
 */
export async function muteMember(id, uid, muted, restore) {
  const before = change(id, g => restore || ({
    ...g,
    members: g.members.map(m => (m.uid === uid ? { ...m, muted } : m)),
    moments: muted ? g.moments.filter(m => !m.who?.includes(uid)) : g.moments,
  }))
  try {
    if (!mocked) await setMute(id, uid, muted)
  } catch (e) {
    putBack(id, before)
    throw e
  }
  reload(id)
  return before
}

/** Mutes (or unmutes) this group's notifications for the viewer. */
export async function muteGroupNotifications(id, muted) {
  const before = change(id, g => ({ ...g, muteNotifications: muted }))
  try {
    if (!mocked) await setGroupPrefs(id, { muteNotifications: muted })
  } catch (e) {
    putBack(id, before)
    throw e
  }
}

/** Removes a Trained together moment (either person can); a refused request puts it back and throws. */
export async function removeGroupMoment(id, mid) {
  const before = change(id, g => ({ ...g, moments: g.moments.filter(m => m.id !== mid) }))
  try {
    if (!mocked) await removeMomentRequest(id, mid)
  } catch (e) {
    putBack(id, before)
    throw e
  }
  reload(id)
}

/**
 * Leaves the group (no Undo). The entry is marked `left` first, so the 404 the next refetch would
 * get is not mistaken for being removed, and the groups cache refetches.
 */
export async function leaveThisGroup(id) {
  if (!mocked) await leaveRequest(id)
  const e = entryOf(id)
  e.epoch++
  put(id, { status: 'left' })
  if (!mocked) await refreshFriends()
}

/**
 * `{ group, status, stale, offline, cheer, uncheer, mute, setNotifications, removeMoment, leave }`.
 * `cheer(momentId)` / `uncheer(momentId)` / `removeMoment(momentId)`; `mute(uid, muted, restore?)`;
 * `setNotifications(muted)` is true to silence the group. Writes throw a FriendsError for the
 * caller to toast, after putting back what they changed.
 */
export function useGroup(id) {
  useEffect(() => (id && friendsAvailable() ? watchGroup(id) : undefined), [id])
  const snap = useSyncExternalStore(subscribe, () => snapshotOf(id), () => snapshotOf(id))
  const actions = useMemo(() => ({
    cheer: mid => cheerMoment(id, mid),
    uncheer: mid => uncheerMoment(id, mid),
    mute: (uid, muted, restore) => muteMember(id, uid, muted, restore),
    setNotifications: muted => muteGroupNotifications(id, muted),
    removeMoment: mid => removeGroupMoment(id, mid),
    leave: () => leaveThisGroup(id),
  }), [id])
  return { ...snap, ...actions }
}

/** The live group for a drawer opened over the page: it redraws when the page's group changes. */
export function useGroupSnapshot(id) {
  return useSyncExternalStore(subscribe, () => snapshotOf(id), () => snapshotOf(id))
}

/** Forgets every group and mark: another account signed in, or the tests starting over. */
export function resetGroups() {
  entries.forEach(e => clearInterval(e.timer))
  entries.clear()
  marks.clear()
  listeners.forEach(fn => fn())
}

/**
 * The gallery's and the tests' seam: shows `group` for `id` without any network and keeps every
 * refresh and write local. Returns the function that puts the real cache back.
 */
export function __setMockGroup(id, group, { status = 'ready' } = {}) {
  const before = entries.get(id)
  const was = mocked
  mocked = true
  // A state shows the numbers it is given: marks left by another state of the same group would raise them.
  for (const key of [...marks.keys()]) if (key.startsWith(id + '|')) marks.delete(key)
  entries.set(id, { snap: { group: group ? applyHighWater(id, normalize(group)) : null, status, stale: false, offline: false }, watchers: before?.watchers ?? 0, timer: before?.timer ?? null, inflight: null, epoch: 0 })
  listeners.forEach(fn => fn())
  return () => {
    mocked = was
    for (const key of [...marks.keys()]) if (key.startsWith(id + '|')) marks.delete(key)
    if (before) entries.set(id, before)
    else entries.delete(id)
    listeners.forEach(fn => fn())
  }
}

/** True while the gallery's or a test's mock is installed. */
export const isMockGroup = () => mocked
