// @vitest-environment happy-dom
// This week's cheers: cleaned and newest first, the page tells the server it looked (seen) and the
// background refresh does not, a server without cheers reads as an empty week, a failed refresh
// keeps the last list and says so, and nothing loads while Friends is off.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ getCheers: vi.fn(), user: { id: 'u1', name: 'Adrian' } }))
vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../mobile.js', () => ({ MOBILE: false }))
vi.mock('../demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('./api.js', async importActual => ({ ...(await importActual()), getCheers: (...a) => mocks.getCheers(...a) }))

import { FriendsError } from './api.js'
import { __setMockFriends } from './store.js'
import { ME_OFF, ME_ON } from '../../dev/screens/states/friends-fixture.js'
import { CHEERS_WITH_WEEK } from '../../dev/screens/states/friends-surfaces-fixture.js'
import { __setMockCheers, getCheersSnapshot, refreshCheers, resetCheers, useCheers } from './use-cheers.js'

const view = useView()
let undoFriends = null

beforeEach(() => {
  resetCheers()
  mocks.getCheers.mockReset().mockResolvedValue(CHEERS_WITH_WEEK)
})
afterEach(() => { undoFriends?.(); undoFriends = null })

describe('refreshCheers', () => {
  it('keeps the cleaned rows, newest first', async () => {
    mocks.getCheers.mockResolvedValue([
      { id: 'a', from: { uid: 'u1', name: 'Mara' }, group: 'g', kind: 'moment', ref: 'r', at: '2026-10-17T10:00:00Z' },
      { id: 'b', from: { uid: 'u2' }, kind: 'moment', ref: 'r', at: '2026-10-17T12:00:00Z' },
      { id: 'c', from: { uid: 'u3', name: 'Radu' }, group: 'g', kind: 'moment', ref: 'r', at: '2026-10-17T11:00:00Z' },
    ])
    await refreshCheers()
    expect(getCheersSnapshot().cheers.map(c => c.id)).toEqual(['c', 'a'])
  })

  it('opening the page says so to the server; the background refresh does not', async () => {
    await refreshCheers()
    expect(mocks.getCheers).toHaveBeenLastCalledWith({ seen: false })
    await refreshCheers({ seen: true })
    expect(mocks.getCheers).toHaveBeenLastCalledWith({ seen: true })
  })

  it('a server that has no cheers yet reads as an empty week, not an error', async () => {
    mocks.getCheers.mockRejectedValue(new FriendsError('x', { code: 'http-404', status: 404 }))
    await refreshCheers()
    expect(getCheersSnapshot()).toMatchObject({ cheers: [], stale: false })
  })

  it('a failed refresh keeps the last list and marks it stale', async () => {
    await refreshCheers()
    mocks.getCheers.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await refreshCheers()
    expect(getCheersSnapshot()).toMatchObject({ stale: true, offline: true })
    expect(getCheersSnapshot().cheers).toHaveLength(CHEERS_WITH_WEEK.length)
  })

  it('something that is not a list is not an answer', async () => {
    mocks.getCheers.mockResolvedValue({ html: 'proxy page' })
    await refreshCheers()
    expect(getCheersSnapshot().cheers).toBeNull()
  })
})

describe('useCheers', () => {
  let seen
  function Probe({ markSeen }) { seen = useCheers({ markSeen }); return null }

  it('loads while Friends is on and exposes the list', async () => {
    undoFriends = __setMockFriends({ me: ME_ON, groups: [] })
    await act(async () => { view.root.render(<Probe />) })
    expect(seen).toMatchObject({ ready: true, stale: false })
    expect(seen.cheers).toHaveLength(CHEERS_WITH_WEEK.length)
  })

  it('the page marks the cheers seen on open', async () => {
    undoFriends = __setMockFriends({ me: ME_ON, groups: [] })
    await act(async () => { view.root.render(<Probe markSeen />) })
    expect(mocks.getCheers).toHaveBeenCalledWith({ seen: true })
  })

  it('asks for nothing while Friends is off', async () => {
    undoFriends = __setMockFriends({ me: ME_OFF, groups: [] })
    await act(async () => { view.root.render(<Probe />) })
    expect(mocks.getCheers).not.toHaveBeenCalled()
    expect(seen).toMatchObject({ cheers: null, ready: false })
  })

  it('the gallery\'s mock shows its rows with no request', async () => {
    undoFriends = __setMockFriends({ me: ME_ON, groups: [] })
    const undo = __setMockCheers(CHEERS_WITH_WEEK)
    await act(async () => { view.root.render(<Probe markSeen />) })
    expect(mocks.getCheers).not.toHaveBeenCalled()
    expect(seen.cheers).toHaveLength(CHEERS_WITH_WEEK.length)
    undo()
  })
})
