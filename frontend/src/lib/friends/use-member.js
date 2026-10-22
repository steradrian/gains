import { useEffect, useState, useSyncExternalStore } from 'react'
import { t } from '../i18n.js'
import { useUI } from '../../store/useUI.js'
import { memberTone } from '../../ds/MemberAvatar.jsx'
import { friendsErrorText, getGroup, getMember, isOffline, removeMember, sendCheer, setMute, undoCheer } from './api.js'
import { serverWeekKey } from './member-view.js'
import { refreshFriends } from './store.js'

// The Member page's data and writes (boards Fr2Member, Fr2Gap, Fr2MemberMenu, Fr2Remove): the
// member's payload (only what that person shares) together with the group they are viewed in, kept
// in memory per (group, person) so the page and its menu see the same thing. Self-contained on
// purpose: group-m1's useGroup is not imported, both read the contract routes through api.js.
//
// Online-only (shared decision 6): a failed refresh keeps what was loaded and says `stale`; a failed
// write undoes its optimistic change and is toasted. Cheer and Mute are optimistic and have an Undo;
// Remove has neither (R5) and waits for the server.

export const REFRESH_MS = 60000

const IDLE = Object.freeze({ member: null, group: null, status: 'idle', gone: null, stale: false, offline: false, removed: false })

const entries = new Map()
const listeners = new Set()
const inflight = new Map()
const queues = new Map()
const writing = new Map()
let mocked = false

const keyOf = (groupId, uid) => groupId + '|' + uid
const read = key => entries.get(key) || IDLE
const write = (key, patch) => {
  entries.set(key, { ...read(key), ...patch })
  listeners.forEach(fn => fn())
}
const subscribe = fn => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const toast = (...args) => useUI.getState().toast(...args)

const rowOf = (group, uid) => group?.members?.find(m => m.uid === uid) || null
const ok = (member, group) => typeof member?.uid === 'string' && typeof member?.name === 'string' && Array.isArray(group?.members)

// One write at a time per person, in the order they were asked: an Undo tapped while its cheer is
// still on the wire goes after it, not before. A refresh that lands meanwhile is ignored (below).
function enqueue(key, job) {
  writing.set(key, (writing.get(key) || 0) + 1)
  const run = (queues.get(key) || Promise.resolve()).then(() => (mocked ? undefined : job()))
  queues.set(key, run.catch(() => {}))
  const done = () => writing.set(key, writing.get(key) - 1)
  run.then(done, done)
  return run
}

/**
 * Fetches the member and the group they are viewed in together. A 404 on either means the person
 * (or the group) is gone for this viewer: `status: 'gone'`. Any other failure keeps what was
 * loaded and marks it stale. One request at a time per person.
 */
export function refreshMember(groupId, uid) {
  if (mocked) return Promise.resolve()
  const key = keyOf(groupId, uid)
  const cur = read(key)
  if (cur.removed) return Promise.resolve()
  if (inflight.has(key)) return inflight.get(key)
  if (!cur.member) write(key, { status: 'loading' })
  const run = Promise.allSettled([getMember(groupId, uid), getGroup(groupId)])
    .then(([m, g]) => {
      if (inflight.get(key) !== run || writing.get(key) > 0) return
      const missing = [m, g].find(r => r.status === 'rejected' && r.reason?.status === 404)
      if (missing) {
        write(key, { status: 'gone', gone: g.status === 'rejected' && g.reason?.status === 404 ? 'group' : 'member', stale: false, offline: false })
        return
      }
      const failed = [m, g].find(r => r.status === 'rejected')
      if (failed || !ok(m.value, g.value)) {
        write(key, { status: read(key).member ? 'ready' : 'error', stale: !!read(key).member, offline: failed ? isOffline(failed.reason) : false })
        return
      }
      write(key, { member: m.value, group: g.value, status: 'ready', gone: null, stale: false, offline: false })
    })
    .finally(() => { if (inflight.get(key) === run) inflight.delete(key) })
  inflight.set(key, run)
  return run
}

const onFocus = new Set()
let focusBound = false
const bindFocus = () => {
  if (focusBound) return
  focusBound = true
  const fire = () => { if (document.visibilityState !== 'hidden') onFocus.forEach(fn => fn()) }
  document.addEventListener('visibilitychange', fire)
  window.addEventListener('focus', fire)
}

// A "gone" answer (or a removal) from an earlier visit must not send this one away, or keep it
// from asking: the person may have been invited back since.
function forgetEnded(key) {
  const cur = read(key)
  if (cur.status !== 'gone' && !cur.removed) return false
  entries.delete(key)
  return true
}

/** The page is on show: refetch now, on focus and every 60 s. Returns the function that stops. */
export function watchMember(groupId, uid) {
  const key = keyOf(groupId, uid)
  if (forgetEnded(key)) listeners.forEach(fn => fn())
  const refresh = () => { void refreshMember(groupId, uid) }
  bindFocus()
  onFocus.add(refresh)
  const timer = setInterval(refresh, REFRESH_MS)
  refresh()
  return () => {
    onFocus.delete(refresh)
    clearInterval(timer)
  }
}

const patchMember = (key, patch) => {
  const m = read(key).member
  if (m) write(key, { member: { ...m, ...patch } })
}
const patchMuted = (key, uid, muted) => {
  const g = read(key).group
  if (g) write(key, { group: { ...g, members: g.members.map(m => (m.uid === uid ? { ...m, muted } : m)) } })
}

const cheerBody = (groupId, uid) => ({ group: groupId, kind: 'week', ref: uid + ':' + serverWeekKey() })

/** Undoes the cheer on the member's week (the toast's Undo): the pill turns back at once. */
export async function undoWeekCheer(groupId, uid) {
  const key = keyOf(groupId, uid)
  if (!read(key).member?.cheered) return false
  patchMember(key, { cheered: false })
  try {
    await enqueue(key, () => undoCheer(cheerBody(groupId, uid)))
  } catch {
    patchMember(key, { cheered: true })
    toast(friendsErrorText())
    return false
  }
  return true
}

/**
 * Cheers the member's whole week: the pill turns at once and the toast offers Undo for 8 s. A
 * failed request turns the pill back and says so. Returns whether the cheer stands.
 */
export async function cheerWeek(groupId, uid) {
  const key = keyOf(groupId, uid)
  const { member, removed } = read(key)
  if (!member || member.cheered || removed) return false
  patchMember(key, { cheered: true })
  toast(t("Cheered {0}'s week", member.name), { action: t('Undo'), onAction: () => { void undoWeekCheer(groupId, uid) } })
  try {
    await enqueue(key, () => sendCheer(cheerBody(groupId, uid)))
  } catch {
    patchMember(key, { cheered: false })
    toast(friendsErrorText())
    return false
  }
  return true
}

/**
 * Mutes (or unmutes) the member for this viewer only: they still count toward the goal and are
 * not told. Muting toasts with Undo, which unmutes quietly. A failed request restores the row.
 */
export async function setMuted(groupId, uid, muted, { quiet = false } = {}) {
  const key = keyOf(groupId, uid)
  const { group, member } = read(key)
  const row = rowOf(group, uid)
  if (!row || !!row.muted === muted) return !!row
  const name = member?.name || row.name
  patchMuted(key, uid, muted)
  if (!quiet) {
    toast(muted ? t('Muted {0}. They are not told.', name) : t('Unmuted {0}', name),
      muted ? { action: t('Undo'), onAction: () => { void setMuted(groupId, uid, false, { quiet: true }) } } : undefined)
  }
  try {
    await enqueue(key, () => setMute(groupId, uid, muted))
  } catch {
    patchMuted(key, uid, !muted)
    toast(friendsErrorText())
    return false
  }
  return true
}

/**
 * Removes the member from the group (creator only, no Undo). Throws the FriendsError on a refusal
 * (403 forbidden, 404 gone) for the confirm to toast; on success the entry is marked removed, so
 * the page neither refetches nor says "no longer in this group" on its way out, and the Groups
 * cache is refetched. Returns the names the confirmation toast uses.
 */
export async function removeFromGroup(groupId, uid) {
  const key = keyOf(groupId, uid)
  const { member, group } = read(key)
  if (!mocked) await removeMember(groupId, uid)
  write(key, { removed: true })
  if (!mocked) void refreshFriends()
  return { name: member?.name || '', groupName: group?.name || '' }
}

/** The gallery's and the tests' seam: shows `member` and `group` with no network. Returns the function that puts the real cache back. */
export function __setMockMember({ groupId, uid, member, group }) {
  const key = keyOf(groupId, uid)
  const before = entries.get(key)
  mocked = true
  write(key, { ...IDLE, member, group, status: 'ready' })
  return () => {
    mocked = false
    if (before) entries.set(key, before); else entries.delete(key)
    listeners.forEach(fn => fn())
  }
}

/** Forgets everything held (tests). */
export function resetMembers() {
  entries.clear()
  inflight.clear()
  queues.clear()
  writing.clear()
  mocked = false
  listeners.forEach(fn => fn())
}

/**
 * What the Member page and its menu read, with no refresh of their own (the page starts that):
 * `{ member, group, status, gone, stale, offline, removed, you, muted, isCreator, tone }`.
 * `you` is the viewer's own page; `tone` is the colour the group gives this person by join order.
 */
export function useMemberState(groupId, uid) {
  const key = keyOf(groupId, uid)
  const snap = useSyncExternalStore(subscribe, () => read(key), () => IDLE)
  const row = rowOf(snap.group, uid)
  const at = snap.group?.members?.findIndex(m => m.uid === uid) ?? -1
  return {
    ...snap,
    you: !!row?.you,
    muted: !!row?.muted,
    isCreator: !!snap.group?.isCreator,
    tone: at >= 0 ? memberTone(at) : 'glass',
  }
}

/** The Member page: the state above, refreshed on mount, on focus and every 60 s while it is open. */
export function useMember(groupId, uid) {
  // Before the first read, so the page never opens on the last visit's ending.
  useState(() => forgetEnded(keyOf(groupId, uid)))
  const state = useMemberState(groupId, uid)
  useEffect(() => watchMember(groupId, uid), [groupId, uid])
  return {
    ...state,
    refresh: () => refreshMember(groupId, uid),
    cheer: () => cheerWeek(groupId, uid),
    mute: muted => setMuted(groupId, uid, muted),
  }
}
