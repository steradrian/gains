// @vitest-environment happy-dom

/* A push already in flight when the page is held for a restart (holdForRestart): the cookie is the
   new session's by the time the server answers, and a 409 carries its document. Merging that into
   this tab's copy and pushing again would write it into the new person's account. Its own file:
   the hold lasts for the life of the page, so it needs a store no other test has held. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn(), stopRest: vi.fn(), abandonWork: vi.fn() }) } }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: async () => true }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  api.mockReset()
  useStore.setState({ S: { ...clone(DEF), _ts: 1 }, user: null, ready: true })
  useStore.getState().setUser({ id: 'u1', name: 'Maria' })
})
afterEach(() => { vi.useRealTimers(); localStorage.clear() })

describe('a push in flight when the page is held for a restart', () => {
  it('is not merged with the new session\'s document and not pushed again when the server refuses it (409)', async () => {
    let refuse = () => {}
    api.mockImplementationOnce(() => new Promise((_, reject) => {
      refuse = () => reject(Object.assign(new Error('HTTP 409'), { status: 409, data: { state: { ...clone(DEF), _ts: 99, restSec: 77 }, rev: 5 } }))
    }))
    api.mockResolvedValue({ ok: true, rev: 6 })
    useStore.getState().update(s => { s.workouts = [{ id: 'w1', d: '2026-09-01', start: 1, end: 2, entries: [] }] })
    const pushing = useStore.getState().pushState()
    await vi.advanceTimersByTimeAsync(0)
    expect(puts()).toHaveLength(1)
    const before = clone(useStore.getState().S)
    useStore.getState().holdForRestart()
    refuse()
    await pushing
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(1)
    expect(useStore.getState().S).toEqual(before)
    expect(useStore.getState().S.restSec).not.toBe(77)
  })
})
