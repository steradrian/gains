// @vitest-environment happy-dom

/* The onboarding found the session is someone else's and is about to reload the page (holdForRestart).
   Until it does, this tab's copy must reach no server under the new cookie, the cached user is
   cleared only if it is still this tab's person's, and nothing else about the signed-in state
   moves (the screens would flash the sign-in, the user's subscribers would reset). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn(), stopRest: vi.fn(), abandonWork: vi.fn() }) } }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: async () => true }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const MARIA = { id: 'u1', name: 'Maria' }
const BEA = { id: 'u2', name: 'Bea' }
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')
const logWorkout = id => useStore.getState().update(s => { s.workouts = [...s.workouts, { id, d: '2026-09-01', start: 1, end: 2, entries: [] }] })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  api.mockReset()
  api.mockResolvedValue({ ok: true, rev: 1 })
  useStore.setState({ S: { ...clone(DEF), _ts: 1 }, user: null, ready: true })
  useStore.getState().setUser(MARIA)
})
afterEach(() => { vi.useRealTimers(); localStorage.clear() })

describe('holding the store for a restart', () => {
  it('(control) a change pushes after its debounce, and the pagehide flush pushes one still waiting', async () => {
    logWorkout('w0')
    await vi.advanceTimersByTimeAsync(2000)
    expect(puts()).toHaveLength(1)
    logWorkout('w1')
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(puts()).toHaveLength(2)
  })

  it('keeps the cached user when it names someone else already (another tab wrote it)', () => {
    localStorage.setItem('gym_user', JSON.stringify(BEA))
    useStore.getState().holdForRestart()
    expect(JSON.parse(localStorage.getItem('gym_user'))).toEqual(BEA)
  })

  it('clears the cached user when it still names this tab\'s person', () => {
    expect(JSON.parse(localStorage.getItem('gym_user'))).toEqual(MARIA)
    useStore.getState().holdForRestart()
    expect(localStorage.getItem('gym_user')).toBeNull()
  })

  it('leaves the signed-in user, and what listens to it, alone', () => {
    const seen = vi.fn()
    const stop = useStore.subscribe(s => seen(s.user))
    useStore.getState().holdForRestart()
    stop()
    expect(useStore.getState().user).toEqual(MARIA)
    expect(seen).not.toHaveBeenCalled()
  })

  it('cancels a push waiting in its debounce', async () => {
    logWorkout('w1')
    useStore.getState().holdForRestart()
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toEqual([])
  })

  it('pushes nothing afterwards: not on a later change, not on the pagehide flush, not when asked', async () => {
    useStore.getState().holdForRestart()
    logWorkout('w2')
    window.dispatchEvent(new Event('pagehide'))
    await useStore.getState().pushState()
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toEqual([])
  })

  it('pulls nothing afterwards either', async () => {
    useStore.getState().holdForRestart()
    await useStore.getState().pullState()
    expect(api).not.toHaveBeenCalled()
  })
})
