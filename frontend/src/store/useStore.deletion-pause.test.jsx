// @vitest-environment happy-dom

/* A scheduled account deletion pauses sync (api/server.js: during the 7-day grace every write is
   refused with 423 { code: 'deletion-scheduled', at }, reads still work). The rules: a 423 is not
   an error and is never retried in a loop; the changes on this device stay exactly as they are,
   owed, and are never marked synced; nothing is wiped; and once /api/me no longer reports the
   deletion (cancelled here or on another device), what waited is pushed as usual. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
const { toast, stopRest, abandonWork } = vi.hoisted(() => ({ toast: vi.fn(), stopRest: vi.fn(), abandonWork: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast, stopRest, abandonWork }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = value => JSON.parse(JSON.stringify(value))
const workout = (id, d = '2026-09-01') => ({ id, d, start: 1, entries: [] })
const httpError = (status, data = {}) => Object.assign(new Error(data.error || 'HTTP ' + status), { status, data })
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT').map(([, o]) => JSON.parse(o.body))
const paths = () => api.mock.calls.map(([p, o]) => (o?.method || 'GET') + ' ' + p)
const wait = (ms = 20) => new Promise(r => setTimeout(r, ms))
const USER = { id: 'user-1', name: 'One' }
const AT = '2026-10-29T12:00:00.000Z'
const REQ = '2026-10-22T12:00:00.000Z'
const LOCKED = () => httpError(423, { error: 'deletion scheduled', code: 'deletion-scheduled', at: AT })
const fresh = { offline: false, pending: false, auth: false, lastError: null, lastSynced: 0, server: null, paused: false }
const signedIn = (S, user = USER) => useStore.setState({ S, user, ready: true, sync: { ...fresh } })
// The server during the grace: writes refused, reads answered. `me` is what /api/me says now.
const graceServer = ({ me = { ...USER, deletion: { at: AT, requestedAt: REQ } }, rev = 1 } = {}) => api.mockImplementation(async (path, o) => {
  if (o?.method === 'PUT') throw LOCKED()
  if (path === '/api/data/rev') return { rev }
  if (path === '/api/me') return { user: typeof me === 'function' ? me() : me }
  if (path === '/api/data') return { state: null, rev }
  throw new Error('unexpected ' + path)
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gym_owner', USER.id)
  api.mockReset(); toast.mockReset()
  useStore.setState({ S: clone(DEF), user: null, ready: false, sync: { ...fresh }, config: null })
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  useStore.setState({ S: clone(DEF), user: null, ready: false, sync: { ...fresh }, config: null })
})

describe('a 423 pauses sync', () => {
  it('keeps the change owed and on this device, marks nothing synced, and says paused, not error', async () => {
    const S = { ...clone(DEF), _ts: 500, workouts: [workout('w1')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    localStorage.setItem('gym_synced_at', '42')
    api.mockRejectedValueOnce(LOCKED())

    await useStore.getState().pushState()

    const st = useStore.getState()
    expect(st.sync).toMatchObject({ status: 'paused', paused: AT, pending: true, lastError: null, offline: false, auth: false })
    expect(st.S).toBe(S)   // the copy is untouched
    expect(st.S.workouts.map(w => w.id)).toEqual(['w1'])
    expect(localStorage.getItem('gym_dirty')).toBe('1')
    expect(JSON.parse(localStorage.getItem('gym_sync'))).toEqual({ rev: 1, ts: 100 })   // the marker did not move
    expect(localStorage.getItem('gym_synced_at')).toBe('42')
    expect(st.sync.lastSynced).toBe(0)
    expect(st.unsyncedChanges().owed).toBe(true)
    expect(st.user.deletion).toEqual({ at: AT })   // the screens can say when, though /api/me has not yet
    expect(toast).not.toHaveBeenCalled()
  })

  it('never retries in a loop: later edits and resumes send no write, and nothing is confirmed', async () => {
    const S = { ...clone(DEF), _ts: 500, workouts: [workout('w1')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    graceServer()
    await useStore.getState().pushState()
    expect(puts()).toHaveLength(1)

    useStore.getState().update(s => { s.restSec = 30 })
    await useStore.getState().pushState()
    for (let i = 0; i < 3; i++) { window.dispatchEvent(new Event('online')); await wait() }
    await useStore.getState().syncNow()

    expect(puts()).toHaveLength(1)   // only the one that learnt of the deletion
    const st = useStore.getState()
    expect(st.sync.status).toBe('paused')
    expect(st.sync.lastSynced).toBe(0)
    expect(st.S.restSec).toBe(30)
    expect(st.S.workouts.map(w => w.id)).toEqual(['w1'])
    expect(localStorage.getItem('gym_dirty')).toBe('1')
  })

  it('a refused read from an older server pauses too, instead of reading as an error', async () => {
    signedIn({ ...clone(DEF), _ts: 100 })
    api.mockRejectedValueOnce(LOCKED())
    await useStore.getState().pullState()
    expect(useStore.getState().sync).toMatchObject({ status: 'paused', lastError: null })
  })
})

describe('user.deletion from /api/me', () => {
  it('pauses before anything is pushed, and an edit meanwhile waits, owed', async () => {
    const S = { ...clone(DEF), _ts: 100, workouts: [workout('w1')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    useStore.getState().setUser({ ...USER, deletion: { at: AT, requestedAt: REQ } })
    expect(useStore.getState().sync).toMatchObject({ status: 'paused', paused: AT })

    useStore.getState().update(s => { s.restSec = 45 })
    await useStore.getState().pushState()

    expect(puts()).toEqual([])
    expect(useStore.getState().sync.pending).toBe(true)
    expect(localStorage.getItem('gym_dirty')).toBe('1')
  })

  it('gone (cancelled): sync resumes and the waiting changes are pushed as usual', async () => {
    const S = { ...clone(DEF), _ts: 500, workouts: [workout('w1'), workout('w2')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    api.mockRejectedValueOnce(LOCKED())
    await useStore.getState().pushState()
    expect(useStore.getState().sync.status).toBe('paused')

    api.mockResolvedValue({ ok: true, rev: 2 })
    useStore.getState().setUser({ ...USER })   // what cancelDeletion's /api/me read hands over
    await wait()

    expect(puts()).toHaveLength(2)
    expect(puts()[1].state.workouts.map(w => w.id)).toEqual(['w1', 'w2'])
    expect(puts()[1].baseRev).toBe(1)
    const st = useStore.getState()
    expect(st.sync).toMatchObject({ status: 'ok', paused: false, pending: false })
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('a reset made while paused does not go out forced after the cancel (another device may have written by then)', async () => {
    signedIn({ ...clone(DEF), _ts: 100, workouts: [workout('w1')] })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    useStore.getState().setUser({ ...USER, deletion: { at: AT, requestedAt: REQ } })
    useStore.getState().replaceState({ ...clone(DEF), _ts: 900 }, true)
    await useStore.getState().pushState()
    expect(puts()).toEqual([])

    api.mockResolvedValue({ ok: true, rev: 2 })
    useStore.getState().setUser({ ...USER })
    await wait()
    expect(puts()).toHaveLength(1)
    expect(puts()[0].baseRev).toBe(1)
  })

  it('coming back to the app asks /api/me again: a deletion cancelled on another device resumes here', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 3600000)   // past any earlier test's resume check
    const S = { ...clone(DEF), _ts: 500, workouts: [workout('w1')] }
    signedIn(S)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    let cancelled = false
    api.mockImplementation(async (path, o) => {
      if (o?.method === 'PUT') { if (!cancelled) throw LOCKED(); return { ok: true, rev: 2 } }
      if (path === '/api/me') return { user: cancelled ? { ...USER } : { ...USER, deletion: { at: AT, requestedAt: REQ } } }
      if (path === '/api/data/rev') return { rev: 1 }
      throw new Error('unexpected ' + path)
    })
    await useStore.getState().pushState()
    expect(useStore.getState().sync.status).toBe('paused')

    cancelled = true
    window.dispatchEvent(new Event('online'))
    await wait(40)

    expect(paths()).toContain('GET /api/me')
    expect(puts()).toHaveLength(2)
    expect(useStore.getState().sync.status).toBe('ok')
  })

  it('signing out ends the pause', () => {
    signedIn({ ...clone(DEF) })
    useStore.getState().setUser({ ...USER, deletion: { at: AT, requestedAt: REQ } })
    useStore.getState().setUser(null)
    expect(useStore.getState().sync).toMatchObject({ status: 'local', paused: false })
  })
})
