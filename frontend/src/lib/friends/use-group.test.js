// @vitest-environment happy-dom
// The live group (boards Fr2Group, Fr2Cheered, Fr2Muted, Fr2Leave): the high-water mark that keeps
// the ring from going backwards, optimistic cheer / mute / remove that put the exact previous group
// back on failure, an answer that predates a write standing aside, 404 as "gone", and leaving.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getGroup: vi.fn(), sendCheer: vi.fn(), undoCheer: vi.fn(), setMute: vi.fn(), setGroupPrefs: vi.fn(), removeMoment: vi.fn(), leaveGroup: vi.fn(),
}))
vi.mock('./api.js', () => ({ ...api, friendsAvailable: () => true, isOffline: e => e?.code === 'offline' }))
const refreshFriends = vi.hoisted(() => vi.fn())
vi.mock('./store.js', () => ({ refreshFriends }))

import { GROUP_FULL } from '../../dev/screens/states/friends-group-fixture.js'
import {
  applyHighWater, cheerMoment, groupSnapshot, leaveThisGroup, muteMember, removeGroupMoment, resetGroups, uncheerMoment, watchGroup,
} from './use-group.js'

const ID = GROUP_FULL.id
const flush = () => new Promise(r => setTimeout(r, 0))
const refused = (code = 'http-500') => Object.assign(new Error('no'), { code })
const moment = (group, id) => group().moments.find(m => m.id === id)
let stop = null

// Starts watching the group with `answer` as the first GET and waits for it to land. Afterwards
// every GET hangs, so a write's own refetch cannot overwrite the optimistic state a test reads.
async function show(answer = GROUP_FULL) {
  api.getGroup.mockResolvedValueOnce(structuredClone(answer))
  api.getGroup.mockReturnValue(new Promise(() => {}))
  stop = watchGroup(ID)
  await flush()
  return () => groupSnapshot(ID).group
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.sendCheer.mockResolvedValue({ ok: true })
  api.undoCheer.mockResolvedValue({ ok: true })
  api.setMute.mockResolvedValue({ ok: true })
  api.removeMoment.mockResolvedValue({ ok: true })
  api.leaveGroup.mockResolvedValue({ ok: true })
  refreshFriends.mockReset()
})
afterEach(() => { stop?.(); stop = null; resetGroups() })

describe('high-water mark', () => {
  const group = (done, week) => ({ members: [{ uid: 'a', done: done[0] }, { uid: 'b', done: done[1] }], week: { done: week, planned: 8 } })

  it('keeps the highest done seen for a member and for the week', () => {
    applyHighWater('g', group([3, 2], 5), '2026-10-19')
    const lower = applyHighWater('g', group([1, 2], 3), '2026-10-19')
    expect(lower.members.map(m => m.done)).toEqual([3, 2])
    expect(lower.week.done).toBe(5)
  })

  it('starts over in a new week and does not hold up a total when a member left', () => {
    applyHighWater('g', group([3, 2], 5), '2026-10-19')
    expect(applyHighWater('g', group([0, 0], 0), '2026-10-26').week.done).toBe(0)
    const left = applyHighWater('g', { members: [{ uid: 'a', done: 3 }], week: { done: 3, planned: 4 } }, '2026-10-19')
    expect(left.week.done).toBe(3)
  })

  it('a refetch that lowers a segment never shows it lower', async () => {
    const group = await show()
    const lowered = structuredClone(GROUP_FULL)
    lowered.members[1].done = 1
    lowered.week.done = 15
    api.getGroup.mockReset()
    api.getGroup.mockResolvedValueOnce(lowered)
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(api.getGroup).toHaveBeenCalledTimes(1)
    expect(group().members[1].done).toBe(GROUP_FULL.members[1].done)
    expect(group().week.done).toBe(GROUP_FULL.week.done)
  })
})

describe('cheer', () => {
  it('turns the pill at once and posts the cheer', async () => {
    const group = await show()
    const sent = cheerMoment(ID, 'mo-legs')
    expect(moment(group, 'mo-legs').cheered).toBe(true)
    await sent
    expect(api.sendCheer).toHaveBeenCalledWith({ group: ID, kind: 'moment', ref: 'mo-legs' })
  })

  it('puts the pill back and throws when the request is refused', async () => {
    const group = await show()
    api.sendCheer.mockRejectedValueOnce(refused())
    await expect(cheerMoment(ID, 'mo-legs')).rejects.toThrow()
    expect(moment(group, 'mo-legs').cheered).toBe(false)
  })

  it('Undo takes the cheer back, and a refused Undo leaves it Cheered', async () => {
    const group = await show()
    await cheerMoment(ID, 'mo-legs')
    await uncheerMoment(ID, 'mo-legs')
    expect(api.undoCheer).toHaveBeenCalledWith({ group: ID, kind: 'moment', ref: 'mo-legs' })
    expect(moment(group, 'mo-legs').cheered).toBe(false)
    await cheerMoment(ID, 'mo-legs')
    api.undoCheer.mockRejectedValueOnce(refused())
    await expect(uncheerMoment(ID, 'mo-legs')).rejects.toThrow()
    expect(moment(group, 'mo-legs').cheered).toBe(true)
  })

  it('an answer that was out before the cheer does not undo it', async () => {
    const group = await show()
    let late
    api.getGroup.mockReset()
    api.getGroup.mockReturnValueOnce(new Promise(r => { late = r }))
    document.dispatchEvent(new Event('visibilitychange'))
    let settle
    api.sendCheer.mockReturnValueOnce(new Promise(r => { settle = r }))
    const sent = cheerMoment(ID, 'mo-legs')
    late(structuredClone(GROUP_FULL))   // predates the cheer: Mara's moment still reads uncheered
    await flush()
    expect(moment(group, 'mo-legs').cheered).toBe(true)
    api.getGroup.mockReturnValue(new Promise(() => {}))
    settle({ ok: true })
    await sent
  })
})

describe('mute', () => {
  it("hides the member's moments at once and marks them muted; they still count", async () => {
    const group = await show()
    await muteMember(ID, 'u-vlad', true)
    expect(api.setMute).toHaveBeenCalledWith(ID, 'u-vlad', true)
    expect(group().members.find(m => m.uid === 'u-vlad').muted).toBe(true)
    expect(group().moments.some(m => m.who.includes('u-vlad'))).toBe(false)
    expect(group().week.done).toBe(GROUP_FULL.week.done)
  })

  it('resolves to the group as it was, and Undo puts exactly that back', async () => {
    const group = await show()
    const before = await muteMember(ID, 'u-vlad', true)
    await muteMember(ID, 'u-vlad', false, before)
    expect(api.setMute).toHaveBeenLastCalledWith(ID, 'u-vlad', false)
    expect(group().moments).toEqual(GROUP_FULL.moments)
    expect(group().members.find(m => m.uid === 'u-vlad').muted).toBe(false)
  })

  it('puts the group back when the request is refused', async () => {
    const group = await show()
    api.setMute.mockRejectedValueOnce(refused())
    await expect(muteMember(ID, 'u-vlad', true)).rejects.toThrow()
    expect(group().moments).toEqual(GROUP_FULL.moments)
  })
})

describe('removing a moment', () => {
  it('drops it at once and posts the removal; a refusal brings it back', async () => {
    const group = await show()
    await removeGroupMoment(ID, 'mo-together')
    expect(api.removeMoment).toHaveBeenCalledWith(ID, 'mo-together')
    expect(moment(group, 'mo-together')).toBeUndefined()
    api.removeMoment.mockRejectedValueOnce(refused())
    await expect(removeGroupMoment(ID, 'mo-best')).rejects.toThrow()
    expect(moment(group, 'mo-best')).toBeDefined()
  })
})

describe('the group going away', () => {
  it('a 404 not-found is "gone", never a stale group', async () => {
    api.getGroup.mockRejectedValueOnce(refused('not-found'))
    stop = watchGroup(ID)
    await flush()
    expect(groupSnapshot(ID).status).toBe('gone')
    expect(groupSnapshot(ID).group).toBeNull()
  })

  it('any other failure keeps what was loaded and marks it stale', async () => {
    await show()
    api.getGroup.mockReset()
    api.getGroup.mockRejectedValueOnce(refused('offline'))
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(groupSnapshot(ID)).toMatchObject({ status: 'ready', stale: true, offline: true })
    expect(groupSnapshot(ID).group.name).toBe(GROUP_FULL.name)
  })

  it('leaving is requested once, marks the group left (its own 404 is not "removed") and refetches the groups', async () => {
    await show()
    await leaveThisGroup(ID)
    expect(api.leaveGroup).toHaveBeenCalledTimes(1)
    expect(api.leaveGroup).toHaveBeenCalledWith(ID)
    expect(refreshFriends).toHaveBeenCalled()
    api.getGroup.mockReset()
    api.getGroup.mockRejectedValueOnce(refused('not-found'))
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(groupSnapshot(ID).status).toBe('left')
  })

  it('a refused leave throws and leaves the group as it was', async () => {
    await show()
    api.leaveGroup.mockRejectedValueOnce(refused())
    await expect(leaveThisGroup(ID)).rejects.toThrow()
    expect(groupSnapshot(ID).status).toBe('ready')
  })
})
