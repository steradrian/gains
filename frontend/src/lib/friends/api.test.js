// @vitest-environment happy-dom
// The Friends client: errors map to FriendsError with the contract's code, reads carry the local
// date, and Friends exists only for a signed-in person on a server that has it.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ api: vi.fn(), user: { id: 'u1', name: 'Ana' }, remote: '', MOBILE: false, DEMO: false }))
vi.mock('../api.js', () => ({ api: (...a) => mocks.api(...a), remoteServer: () => mocks.remote }))
vi.mock('../mobile.js', () => ({ get MOBILE() { return mocks.MOBILE } }))
vi.mock('../demo.js', () => ({ get DEMO() { return mocks.DEMO } }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ user: mocks.user }) } }))

import { todayISO } from '../format.js'
import {
  FriendsError, createChallenge, createGroup, createInvite, friendsAvailable, friendsErrorText, getJoinPreview, getMe, isMissing,
  isOffline, joinChallenge, joinGroup, leaveChallenge, putMe, sendCheer, setAvailableOverride, setServerMissing, toFriendsError, undoCheer,
} from './api.js'

beforeEach(() => {
  mocks.api.mockReset()
  mocks.user = { id: 'u1', name: 'Ana' }
  mocks.remote = ''
  mocks.MOBILE = false
  mocks.DEMO = false
  setServerMissing(false)
  setAvailableOverride(null)
})

const failing = (status, data) => Object.assign(new Error(data?.error || 'HTTP ' + status), { status, data })

describe('FriendsError mapping', () => {
  it('carries the contract code and status from { error, code }', async () => {
    mocks.api.mockRejectedValue(failing(409, { error: 'Already in', code: 'already-member', group: { id: 'g1' } }))
    const err = await getJoinPreview('abc').catch(e => e)
    expect(err).toBeInstanceOf(FriendsError)
    expect(err.code).toBe('already-member')
    expect(err.status).toBe(409)
    expect(err.data.group.id).toBe('g1')
  })

  it('an error with no body is http-<status>; a request nothing answered is offline', () => {
    expect(toFriendsError(failing(500)).code).toBe('http-500')
    const offline = toFriendsError(Object.assign(new Error('Failed to fetch'), {}))
    expect(offline.code).toBe('offline')
    expect(isOffline(offline)).toBe(true)
    expect(isOffline(toFriendsError(failing(500)))).toBe(false)
  })

  it('a timeout from api() is offline, a phone with no server and a foreign answer are "missing"', () => {
    expect(toFriendsError(Object.assign(new Error('slow'), { code: 'timeout' })).code).toBe('offline')
    expect(isMissing(toFriendsError(Object.assign(new Error('x'), { code: 'not-paired', status: 0 })))).toBe(true)
    expect(isMissing(toFriendsError(Object.assign(new Error('x'), { code: 'bad-response', status: 200 })))).toBe(true)
    expect(isMissing(toFriendsError(failing(404)))).toBe(true)
    expect(isMissing(toFriendsError(failing(409, { code: 'invite-used' })))).toBe(false)
  })

  it('a failed write is toasted in one line that never repeats the server', () => {
    expect(friendsErrorText()).toBe("Couldn't do that. Try again when you're online.")
  })
})

describe('requests', () => {
  it('reads carry the local date; writes carry a JSON body on the right route', async () => {
    mocks.api.mockResolvedValue({})
    await getMe()
    expect(mocks.api.mock.calls[0][0]).toMatch(/^\/api\/friends\/me\?date=\d{4}-\d{2}-\d{2}$/)
    await putMe({ on: true, share: { training: true, consistency: true, targets: false, bests: false } })
    const [path, init] = mocks.api.mock.calls[1]
    expect(path).toBe('/api/friends/me')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ on: true, share: { training: true, consistency: true, targets: false, bests: false } })
  })

  it('escapes ids and sends no body where the contract has none', async () => {
    mocks.api.mockResolvedValue({})
    await createInvite('a/b')
    expect(mocks.api.mock.calls[0][0]).toBe('/api/friends/groups/a%2Fb/invites')
    expect(mocks.api.mock.calls[0][1]).toEqual({ method: 'POST' })
    await undoCheer({ group: 'g1', kind: 'moment', ref: 'm1' })
    expect(mocks.api.mock.calls[1][1].method).toBe('DELETE')
  })

  it('create, join and cheer carry the local date, for groups and challenges, and keep their bodies', async () => {
    mocks.api.mockResolvedValue({})
    const today = todayISO()
    await createGroup({ name: 'Crew', goal: { kind: 'planned' } })
    await joinGroup('ab/c')
    await createChallenge('g1', { template: 'workouts', span: 'week' })
    await joinChallenge('g1', 'c1')
    await leaveChallenge('g1', 'c1')
    await sendCheer({ group: 'g1', kind: 'week', ref: 'u2:2026-10-12' })
    expect(mocks.api.mock.calls.map(c => c[0])).toEqual([
      `/api/friends/groups?date=${today}`,
      `/api/friends/join/ab%2Fc?date=${today}`,
      `/api/friends/groups/g1/challenges?date=${today}`,
      `/api/friends/groups/g1/challenges/c1/join?date=${today}`,
      `/api/friends/groups/g1/challenges/c1/leave?date=${today}`,
      `/api/friends/cheers?date=${today}`,
    ])
    expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toEqual({ name: 'Crew', goal: { kind: 'planned' } })
    expect(mocks.api.mock.calls[1][1]).toEqual({ method: 'POST' })
    expect(JSON.parse(mocks.api.mock.calls[2][1].body)).toEqual({ template: 'workouts', span: 'week' })
  })

  it('a bad-date refusal is toasted as a device clock problem', async () => {
    mocks.api.mockRejectedValue(failing(400, { error: 'date must be your local today', code: 'bad-date' }))
    const err = await joinGroup('abc').catch(e => e)
    expect(err.code).toBe('bad-date')
    expect(friendsErrorText(err)).toBe("Your device's date looks off. Check it and try again.")
  })
})

describe('friendsAvailable', () => {
  it('is true for a signed-in person on the web', () => {
    expect(friendsAvailable()).toBe(true)
  })

  it('is false for a guest, the demo, a phone with no server, and a server that has no Friends', () => {
    mocks.user = null
    expect(friendsAvailable()).toBe(false)
    mocks.user = { id: 'u1' }
    mocks.DEMO = true
    expect(friendsAvailable()).toBe(false)
    mocks.DEMO = false
    mocks.MOBILE = true
    expect(friendsAvailable()).toBe(false)
    mocks.remote = 'https://gym.example'
    expect(friendsAvailable()).toBe(true)
    setServerMissing(true)
    expect(friendsAvailable()).toBe(false)
  })

  it('the gallery override wins either way', () => {
    mocks.user = null
    setAvailableOverride(true)
    expect(friendsAvailable()).toBe(true)
  })
})
