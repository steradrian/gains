// @vitest-environment happy-dom
// The live challenge (boards Fr3Join, Fr3Challenge): fetched on watch, Count me in and Leave write
// once and refetch, a refused write changes nothing, an answer that predates a write stands aside,
// and a 404 is "gone".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getChallenge: vi.fn(), joinChallenge: vi.fn(), leaveChallenge: vi.fn() }))
vi.mock('./api.js', () => ({ ...api, friendsAvailable: () => true, isOffline: e => e?.code === 'offline' }))

import { CHALLENGE_ACTIVE, CHALLENGE_NOT_JOINED } from '../../dev/screens/states/friends-fixture.js'
import {
  challengeSnapshot, joinThisChallenge, leaveThisChallenge, resetChallenges, watchChallenge,
} from './use-challenge.js'

const GID = 'g1'
const CID = CHALLENGE_ACTIVE.id
const flush = () => new Promise(r => setTimeout(r, 0))
const refused = (code = 'http-500') => Object.assign(new Error('no'), { code })
const snap = () => challengeSnapshot(GID, CID)
let stop = null

// Starts watching with `answer` as the first GET and waits for it to land.
async function show(answer = CHALLENGE_NOT_JOINED) {
  api.getChallenge.mockResolvedValueOnce(structuredClone(answer))
  stop = watchChallenge(GID, CID)
  await flush()
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.getChallenge.mockReturnValue(new Promise(() => {}))
})
afterEach(() => { stop?.(); stop = null; resetChallenges() })

describe('watching', () => {
  it('fetches on watch and shows the challenge, with every list present', async () => {
    await show({ id: CID, title: 'x', template: 'workouts' })
    expect(api.getChallenge).toHaveBeenCalledWith(GID, CID)
    expect(snap().status).toBe('ready')
    expect(snap().challenge.joined).toEqual([])
    expect(snap().challenge.invited).toEqual([])
  })

  it('keeps the last challenge and says stale when a refresh fails', async () => {
    await show()
    api.getChallenge.mockRejectedValueOnce(refused('offline'))
    stop()
    stop = watchChallenge(GID, CID)
    await flush()
    expect(snap().challenge.id).toBe(CID)
    expect(snap()).toMatchObject({ status: 'ready', stale: true, offline: true })
  })

  it('treats a 404 as gone, so the screen leaves', async () => {
    api.getChallenge.mockRejectedValueOnce(refused('not-found'))
    stop = watchChallenge(GID, CID)
    await flush()
    expect(snap()).toMatchObject({ status: 'gone', challenge: null })
  })

  it('says error when nothing ever loaded', async () => {
    api.getChallenge.mockRejectedValueOnce(refused('offline'))
    stop = watchChallenge(GID, CID)
    await flush()
    expect(snap().status).toBe('error')
  })
})

describe('Count me in', () => {
  it('writes once, shows the answer at once and refetches', async () => {
    await show(CHALLENGE_NOT_JOINED)
    api.joinChallenge.mockResolvedValue({ ...CHALLENGE_ACTIVE })
    api.getChallenge.mockResolvedValueOnce({ ...CHALLENGE_ACTIVE })
    await joinThisChallenge(GID, CID)
    expect(api.joinChallenge).toHaveBeenCalledTimes(1)
    expect(api.joinChallenge).toHaveBeenCalledWith(GID, CID)
    expect(snap().challenge.you.in).toBe(true)
    await flush()
    expect(api.getChallenge).toHaveBeenCalledTimes(2)
  })

  it('a refused join changes nothing and throws for the caller to toast', async () => {
    await show(CHALLENGE_NOT_JOINED)
    api.joinChallenge.mockRejectedValue(refused('offline'))
    await expect(joinThisChallenge(GID, CID)).rejects.toThrow()
    expect(snap().challenge.you.in).toBe(false)
    expect(api.getChallenge).toHaveBeenCalledTimes(1)
  })

  it('an answer that was out before the write does not undo it', async () => {
    let late
    api.getChallenge.mockReset()
    api.getChallenge.mockReturnValueOnce(new Promise(r => { late = r }))
    stop = watchChallenge(GID, CID)
    api.joinChallenge.mockResolvedValue({ ...CHALLENGE_ACTIVE })
    api.getChallenge.mockReturnValue(new Promise(() => {}))
    await joinThisChallenge(GID, CID)
    late(structuredClone(CHALLENGE_NOT_JOINED))
    await flush()
    expect(snap().challenge.you.in).toBe(true)
  })
})

describe('Leave, and its Undo', () => {
  it('leaves once and shows the not-joined challenge the server answers', async () => {
    await show(CHALLENGE_ACTIVE)
    api.leaveChallenge.mockResolvedValue({ ...CHALLENGE_NOT_JOINED })
    await leaveThisChallenge(GID, CID)
    expect(api.leaveChallenge).toHaveBeenCalledTimes(1)
    expect(snap().challenge.you.in).toBe(false)
  })

  it('Undo is a join again, and the person is back in', async () => {
    await show(CHALLENGE_ACTIVE)
    api.leaveChallenge.mockResolvedValue({ ...CHALLENGE_NOT_JOINED })
    api.joinChallenge.mockResolvedValue({ ...CHALLENGE_ACTIVE })
    await leaveThisChallenge(GID, CID)
    await joinThisChallenge(GID, CID)
    expect(api.joinChallenge).toHaveBeenCalledWith(GID, CID)
    expect(snap().challenge.you.in).toBe(true)
  })

  it('a refused leave keeps the person in', async () => {
    await show(CHALLENGE_ACTIVE)
    api.leaveChallenge.mockRejectedValue(refused())
    await expect(leaveThisChallenge(GID, CID)).rejects.toThrow()
    expect(snap().challenge.you.in).toBe(true)
  })
})
