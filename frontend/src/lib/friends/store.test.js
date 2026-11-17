// @vitest-environment happy-dom
// The Friends cache: one fetch at a time, stale data kept (and said) when a refresh fails, Friends
// unavailable when the server has no Friends, refetch on focus and every 60 s while watched, and a
// mock seam that never touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getMe: vi.fn(), getGroups: vi.fn(), user: { id: 'u1', name: 'Ana' } }))
vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../mobile.js', () => ({ MOBILE: false }))
vi.mock('../demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ user: mocks.user }) } }))
vi.mock('./api.js', async importActual => ({
  ...(await importActual()),
  getMe: (...a) => mocks.getMe(...a),
  getGroups: (...a) => mocks.getGroups(...a),
}))

import { FriendsError, friendsAvailable } from './api.js'
import {
  REFRESH_MS, __setMockFriends, cacheMe, getFriends, isMockFriends, refreshFriends, resetFriends, subscribeFriends, watchFriends,
} from './store.js'

const ME = { on: true, share: { training: true, consistency: true, targets: true, bests: false }, groups: [], invitations: [], newCount: 0 }
const GROUPS = [{ id: 'g1', name: 'Iron Sunday', members: [], week: { done: 1, planned: 2 }, streak: 0 }]

beforeEach(() => {
  mocks.user = { id: 'u1', name: 'Ana' }
  mocks.getMe.mockReset().mockResolvedValue(ME)
  mocks.getGroups.mockReset().mockResolvedValue(GROUPS)
  resetFriends()
})
afterEach(() => { vi.useRealTimers() })

describe('refreshFriends', () => {
  it('loads /me and /groups together and notifies subscribers', async () => {
    const seen = vi.fn()
    const off = subscribeFriends(seen)
    await refreshFriends()
    off()
    expect(getFriends()).toMatchObject({ me: ME, groups: GROUPS, status: 'ready', stale: false })
    expect(seen).toHaveBeenCalled()
  })

  it('asks once while a request is out', async () => {
    const a = refreshFriends()
    const b = refreshFriends()
    await Promise.all([a, b])
    expect(mocks.getMe).toHaveBeenCalledTimes(1)
  })

  it('keeps the last data and says it is stale when a refresh fails; offline when nothing answered', async () => {
    await refreshFriends()
    mocks.getMe.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await refreshFriends()
    expect(getFriends()).toMatchObject({ me: ME, groups: GROUPS, status: 'ready', stale: true, offline: true })
    mocks.getMe.mockResolvedValue(ME)
    await refreshFriends()
    expect(getFriends()).toMatchObject({ stale: false, offline: false })
  })

  it('a server that answers 404 makes Friends unavailable and hides it everywhere', async () => {
    mocks.getMe.mockRejectedValue(new FriendsError('nope', { code: 'http-404', status: 404 }))
    await refreshFriends()
    expect(getFriends().status).toBe('unavailable')
    expect(friendsAvailable()).toBe(false)
  })

  it('an answer that is not Friends data (someone else\'s JSON) counts as the same', async () => {
    mocks.getMe.mockResolvedValue({ passkeys: [] })
    await refreshFriends()
    expect(getFriends().status).toBe('unavailable')
  })

  it('does nothing for a signed-out device, and forgets one account\'s data when another signs in', async () => {
    mocks.user = null
    await refreshFriends()
    expect(mocks.getMe).not.toHaveBeenCalled()
    mocks.user = { id: 'u1', name: 'Ana' }
    await refreshFriends()
    expect(getFriends().me).toEqual(ME)
    mocks.user = { id: 'u2', name: 'Bo' }
    mocks.getMe.mockResolvedValue({ ...ME, on: false })
    const pending = refreshFriends()
    expect(getFriends().me).toBeNull()
    await pending
    expect(getFriends().me.on).toBe(false)
  })

  it('cacheMe puts a write\'s answer straight in', async () => {
    await refreshFriends()
    cacheMe({ ...ME, on: false })
    expect(getFriends().me.on).toBe(false)
  })
})

describe('watchFriends', () => {
  it('fetches now, on focus and every 60 s, and stops when the last screen goes', async () => {
    vi.useFakeTimers()
    const stopA = watchFriends()
    const stopB = watchFriends()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.getMe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(REFRESH_MS)
    expect(mocks.getMe).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.getMe).toHaveBeenCalledTimes(3)
    stopA()
    await vi.advanceTimersByTimeAsync(REFRESH_MS)
    expect(mocks.getMe).toHaveBeenCalledTimes(4)
    stopB()
    stopB()
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3)
    expect(mocks.getMe).toHaveBeenCalledTimes(4)
  })
})

describe('the mock seam', () => {
  it('shows the fixture with no network, and puts the real cache back', async () => {
    await refreshFriends()
    const calls = mocks.getMe.mock.calls.length
    const undo = __setMockFriends({ me: { ...ME, on: false }, groups: [] })
    expect(isMockFriends()).toBe(true)
    expect(friendsAvailable()).toBe(true)
    await refreshFriends()
    expect(mocks.getMe.mock.calls.length).toBe(calls)
    expect(getFriends().me.on).toBe(false)
    undo()
    expect(isMockFriends()).toBe(false)
    expect(getFriends().me).toEqual(ME)
  })
})
