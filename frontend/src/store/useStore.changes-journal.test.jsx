// @vitest-environment happy-dom

/* The change journal (lib/recent-changes.js) is a device fact kept per account: it must not
   outlive the session it was made in. It goes on sign-out, on switching to another account and
   on Start over, and an account's entries are never read by another. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn(), stopRest: vi.fn(), abandonWork: vi.fn() }) } }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: async () => true }))

import { api } from '../lib/api.js'
import { listChanges, recordChange } from '../lib/recent-changes.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const MARIA = { id: 'u1', name: 'Maria' }
const BEA = { id: 'u2', name: 'Bea' }
const journal = () => listChanges().length
const record = () => recordChange({ kind: 'routine-delete', subject: 'Push A', snapshot: {} })

beforeEach(() => {
  localStorage.clear()
  api.mockReset()
  api.mockResolvedValue({ ok: true })
  useStore.setState({ S: { ...clone(DEF), _ts: 1 }, user: null, ready: true })
})
afterEach(() => { localStorage.clear() })

describe('the change journal and the session', () => {
  it('is kept per account', () => {
    useStore.getState().setUser(MARIA)
    record()
    expect(journal()).toBe(1)
    useStore.getState().setUser(BEA)
    expect(journal()).toBe(0)
  })

  it('goes on a sign-out, and on a sign-out everywhere', async () => {
    useStore.getState().setUser(MARIA)
    record()
    await useStore.getState().signOut()
    useStore.getState().setUser(MARIA)
    expect(journal()).toBe(0)

    record()
    await useStore.getState().signOutAll()
    useStore.getState().setUser(MARIA)
    expect(journal()).toBe(0)
  })

  it('goes with the previous account when another one signs in', () => {
    useStore.getState().setUser(MARIA)
    record()
    useStore.getState().setUser(BEA)
    useStore.getState().setUser(MARIA)
    expect(journal()).toBe(0)
  })

  it('goes on Start over', () => {
    useStore.getState().setUser(MARIA)
    record()
    useStore.getState().resetEverything()
    expect(journal()).toBe(0)
  })
})
