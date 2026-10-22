import { useEffect, useSyncExternalStore } from 'react'
import { useStore } from '../../store/useStore.js'
import { friendsAvailable, getCheers, isMissing, isOffline } from './api.js'
import { REFRESH_MS } from './store.js'
import { useFriendsMe } from './use-friends.js'

// This week's cheers for the person (GET /cheers): the Cheers for you page and the cheer items of
// the Notifications feed read the same in-memory copy, which refreshes on mount, on focus and every
// 60 s while something shows it (shared decision 7), the way the Friends cache does. Nothing is
// stored, and a server without cheers (api-m3 not there yet) reads as no cheers, not as an error.

/**
 * @typedef {{ id: string, uid: string, name: string, groupId: string, groupName: string,
 *   kind: 'moment'|'week'|'challenge', moment: string, ref: string, label: string, detail: string,
 *   streak: number, at: number }} Cheer
 * @typedef {{ cheers: Cheer[]|null, stale: boolean, offline: boolean }} CheersSnapshot
 */

const EMPTY = { cheers: null, stale: false, offline: false }

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

const text = v => (typeof v === 'string' ? v : '')

/** One answer row, cleaned: a row with no sender or no time is not shown. */
export function cheerOf(raw) {
  const at = Date.parse(raw?.at)
  const name = text(raw?.from?.name)
  if (!raw || !name || !Number.isFinite(at)) return null
  const group = raw.group && typeof raw.group === 'object' ? raw.group : { id: text(raw.group) }
  return {
    id: text(raw.id) || `${raw.kind}:${raw.ref}:${raw.from?.uid}`,
    uid: text(raw.from?.uid),
    name,
    groupId: text(group.id),
    groupName: text(group.name),
    kind: ['moment', 'week', 'challenge'].includes(raw.kind) ? raw.kind : 'moment',
    moment: text(raw.moment),
    ref: text(raw.ref),
    label: text(raw.label),
    detail: text(raw.detail),
    streak: Number.isFinite(raw.streak) ? raw.streak : 0,
    at,
  }
}

/** The cached cheers; a new object whenever anything changed. */
export const getCheersSnapshot = () => snap

export function subscribeCheers(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Fetches GET /cheers. `seen` is the Cheers for you page being opened (the server then advances
 * the digest's marker). A failure keeps what was cached and marks it stale; a server that does
 * not have the route reads as an empty week. One request at a time.
 */
export function refreshCheers({ seen = false } = {}) {
  if (mocked) return Promise.resolve()
  const who = ownerOf()
  if (who !== owner) { inflight = null; snap = EMPTY; owner = who }
  if (!who) return Promise.resolve()
  if (inflight && !seen) return inflight
  const run = getCheers({ seen })
    .then(list => {
      if (inflight !== run) return
      if (!Array.isArray(list)) throw new TypeError('Not a list of cheers')
      set({ cheers: list.map(cheerOf).filter(Boolean).sort((a, b) => b.at - a.at), stale: false, offline: false })
    })
    .catch(e => {
      if (inflight !== run) return
      if (isMissing(e) && !snap.cheers) { set({ cheers: [], stale: false, offline: false }); return }
      set({ stale: !!snap.cheers, offline: isOffline(e) })
    })
    .finally(() => { if (inflight === run) inflight = null })
  inflight = run
  return run
}

let watchers = 0
let timer = null
const onFocus = () => { if (document.visibilityState !== 'hidden') refreshCheers() }

/** Something shows the cheers: refetch now, on focus and every 60 s until the last one goes. */
export function watchCheers() {
  watchers++
  if (watchers === 1) {
    timer = setInterval(refreshCheers, REFRESH_MS)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
  }
  refreshCheers()
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

/** The gallery's and the tests' seam: shows `cheers` (answer rows) with no network. Returns the function that puts the real copy back. */
export function __setMockCheers(cheers, { stale = false } = {}) {
  const before = { snap, owner, inflight, mocked }
  mocked = true
  inflight = null
  set({ cheers: (cheers || []).map(cheerOf).filter(Boolean).sort((a, b) => b.at - a.at), stale, offline: stale })
  return () => {
    mocked = before.mocked
    inflight = before.inflight
    owner = before.owner
    snap = before.snap
    listeners.forEach(fn => fn())
  }
}

/** Forgets everything (another account signed in, or a test). */
export function resetCheers() {
  inflight = null
  owner = null
  snap = EMPTY
  listeners.forEach(fn => fn())
}

/**
 * `{ cheers, ready, stale, offline }`: this week's cheers, newest first (`null` cheers until the
 * first answer). Only while Friends is on; with `markSeen` (the Cheers for you page) the first
 * fetch also tells the server the person looked.
 */
export function useCheers({ markSeen = false } = {}) {
  const { on } = useFriendsMe()
  const live = on && friendsAvailable()
  useEffect(() => {
    if (!live) return undefined
    const stop = watchCheers()
    if (markSeen) refreshCheers({ seen: true })
    return stop
  }, [live, markSeen])
  const s = useSyncExternalStore(subscribeCheers, getCheersSnapshot, getCheersSnapshot)
  return { cheers: live ? s.cheers : null, ready: live && !!s.cheers, stale: s.stale, offline: s.offline }
}
