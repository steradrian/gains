// @vitest-environment happy-dom
// The writes Friends screens make: turning on sends the switches, turning off sends nothing but
// off (memberships are kept), leaving refetches, and a failure reaches the caller as a
// FriendsError with nothing refetched.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  putMe: vi.fn(), leave: vi.fn(), getMe: vi.fn(), getGroups: vi.fn(), user: { id: 'u1', name: 'Ana' },
}))
vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../mobile.js', () => ({ MOBILE: false }))
vi.mock('../demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => {
  const useStore = selector => selector({ user: mocks.user })
  useStore.getState = () => ({ user: mocks.user })
  return { useStore }
})
vi.mock('./api.js', async importActual => ({
  ...(await importActual()),
  putMe: (...a) => mocks.putMe(...a),
  leaveGroup: (...a) => mocks.leave(...a),
  getMe: (...a) => mocks.getMe(...a),
  getGroups: (...a) => mocks.getGroups(...a),
}))

import { FriendsError } from './api.js'
import { getFriends, resetFriends } from './store.js'
import { leaveGroup, turnOff, turnOn, useFriendsMe, useGroups } from './use-friends.js'

const SHARE = { training: true, consistency: false, targets: false, bests: false }
const ME = { on: true, share: SHARE, groups: [], invitations: [], newCount: 0 }
const GROUPS = [{ id: 'g1', name: 'Iron Sunday', members: [], week: { done: 1, planned: 2 }, streak: 0 }]

beforeEach(() => {
  resetFriends()
  for (const f of [mocks.putMe, mocks.leave, mocks.getMe, mocks.getGroups]) f.mockReset()
  mocks.getMe.mockResolvedValue(ME)
  mocks.getGroups.mockResolvedValue(GROUPS)
  mocks.putMe.mockResolvedValue(ME)
  mocks.leave.mockResolvedValue({ ok: true })
})

describe('the writes', () => {
  it('turnOn sends on and the four switches, then refetches', async () => {
    await turnOn(SHARE)
    expect(mocks.putMe).toHaveBeenCalledWith({ on: true, share: SHARE })
    expect(mocks.getMe).toHaveBeenCalledTimes(1)
    expect(getFriends().me.on).toBe(true)
  })

  it('turnOff sends off and nothing else: no share, no group is touched', async () => {
    mocks.putMe.mockResolvedValue({ ...ME, on: false })
    await turnOff()
    expect(mocks.putMe).toHaveBeenCalledWith({ on: false })
    expect(mocks.leave).not.toHaveBeenCalled()
  })

  it('leaveGroup posts the leave and refetches', async () => {
    await leaveGroup('g1')
    expect(mocks.leave).toHaveBeenCalledWith('g1')
    expect(mocks.getGroups).toHaveBeenCalledTimes(1)
  })

  it('a refused turn on (needs-share) throws the FriendsError and refetches nothing', async () => {
    mocks.putMe.mockRejectedValue(new FriendsError('x', { code: 'needs-share', status: 409 }))
    await expect(turnOn(SHARE)).rejects.toMatchObject({ code: 'needs-share' })
    expect(mocks.getMe).not.toHaveBeenCalled()
  })
})

describe('the hooks', () => {
  const view = useView()
  let seen
  function Probe() { seen = { me: useFriendsMe(), groups: useGroups() }; return null }
  afterEach(() => { seen = null })

  it('load on mount and expose me, on, groups and ready', async () => {
    await act(async () => { view.root.render(<Probe />) })
    expect(seen.me).toMatchObject({ ready: true, on: true, stale: false })
    expect(seen.groups.groups).toEqual(GROUPS)
    expect(seen.groups.ready).toBe(true)
  })
})
