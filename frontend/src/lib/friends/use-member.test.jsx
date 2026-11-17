// @vitest-environment happy-dom
// The Member page's data and writes: one load of the member and its group, a 404 meaning gone, stale
// data kept when a refresh fails, Cheer and Mute optimistic with an Undo that restores exactly what
// was done, Remove with no Undo and no refetch after it, and a mock seam that never reaches the
// network.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), getMember: vi.fn(), getGroup: vi.fn(), sendCheer: vi.fn(), undoCheer: vi.fn(), setMute: vi.fn(), removeMember: vi.fn(), refreshFriends: vi.fn(),
}))
vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../mobile.js', () => ({ MOBILE: false }))
vi.mock('../demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ user: { id: 'u-adrian' } }) } }))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('./store.js', () => ({ refreshFriends: (...a) => mocks.refreshFriends(...a) }))
vi.mock('./api.js', async importActual => ({
  ...(await importActual()),
  getMember: (...a) => mocks.getMember(...a),
  getGroup: (...a) => mocks.getGroup(...a),
  sendCheer: (...a) => mocks.sendCheer(...a),
  undoCheer: (...a) => mocks.undoCheer(...a),
  setMute: (...a) => mocks.setMute(...a),
  removeMember: (...a) => mocks.removeMember(...a),
}))

import { FriendsError } from './api.js'
import { serverWeekKey } from './member-view.js'
import {
  __setMockMember, cheerWeek, refreshMember, removeFromGroup, resetMembers, setMuted, undoWeekCheer, useMemberState,
} from './use-member.js'

const MARA = { uid: 'u-mara', name: 'Mara', since: '2026-08-30', cheered: false, week: { done: 3, planned: 4, days: [] }, shares: { training: true, consistency: true, targets: true, bests: true } }
const GROUP = {
  id: 'g1', name: 'Iron Sunday', isCreator: true, week: { done: 17, planned: 22 },
  members: [
    { uid: 'u-adrian', name: 'Adrian', you: true, muted: false },
    { uid: 'u-mara', name: 'Mara', you: false, muted: false },
  ],
}
const gone = status => new FriendsError('gone', { status, code: 'not-found' })
const body = () => ({ group: 'g1', kind: 'week', ref: 'u-mara:' + serverWeekKey() })
const view = useView()
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

let states = []
function Probe({ uid = 'u-mara' }) {
  states.push(useMemberState('g1', uid))
  return null
}
const last = () => states.at(-1)
const load = async () => { await act(async () => { await refreshMember('g1', 'u-mara') }) }
const withProbe = async () => { await load(); view.render(<Probe />) }

beforeEach(() => {
  resetMembers()
  states = []
  for (const m of Object.values(mocks)) m.mockReset()
  mocks.getMember.mockResolvedValue(MARA)
  mocks.getGroup.mockResolvedValue(GROUP)
  mocks.sendCheer.mockResolvedValue({ ok: true })
  mocks.undoCheer.mockResolvedValue({ ok: true })
  mocks.setMute.mockResolvedValue({ ok: true })
  mocks.removeMember.mockResolvedValue({ ok: true })
})
afterEach(() => { resetMembers() })

describe('refreshMember', () => {
  it('loads the member and the group they are viewed in together', async () => {
    await withProbe()
    expect(mocks.getMember).toHaveBeenCalledWith('g1', 'u-mara')
    expect(mocks.getGroup).toHaveBeenCalledWith('g1')
    expect(last()).toMatchObject({ status: 'ready', member: MARA, group: GROUP, stale: false, you: false, muted: false, isCreator: true })
  })

  it('gives the person the colour their join order gives them, and you the page of your own', async () => {
    await withProbe()
    expect(last().tone).toBe('sky')
    mocks.getMember.mockResolvedValue({ ...MARA, uid: 'u-adrian', name: 'Adrian' })
    await act(async () => { await refreshMember('g1', 'u-adrian') })
    view.render(<Probe uid="u-adrian" />)
    expect(last().you).toBe(true)
  })

  it('a 404 on the member means they are gone from this group', async () => {
    mocks.getMember.mockRejectedValue(gone(404))
    await withProbe()
    expect(last()).toMatchObject({ status: 'gone', gone: 'member' })
  })

  it('a 404 on the group means the group is gone', async () => {
    mocks.getMember.mockRejectedValue(gone(404))
    mocks.getGroup.mockRejectedValue(gone(404))
    await withProbe()
    expect(last()).toMatchObject({ status: 'gone', gone: 'group' })
  })

  it('keeps what it had, marked stale and offline, when a refresh cannot reach the server', async () => {
    await withProbe()
    mocks.getMember.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    await act(async () => { await refreshMember('g1', 'u-mara') })
    expect(last()).toMatchObject({ status: 'ready', member: MARA, stale: true, offline: true })
  })

  it('is an error, with nothing to show, when the very first load fails', async () => {
    mocks.getMember.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    await withProbe()
    expect(last()).toMatchObject({ status: 'error', member: null })
  })

  it('does not take someone else\'s JSON for an answer', async () => {
    mocks.getGroup.mockResolvedValue('<html>')
    await withProbe()
    expect(last().status).toBe('error')
  })
})

describe('cheerWeek', () => {
  it('turns the pill at once, toasts with Undo, and sends the week of the person', async () => {
    await withProbe()
    let release
    mocks.sendCheer.mockReturnValue(new Promise(resolve => { release = resolve }))
    let done
    act(() => { done = cheerWeek('g1', 'u-mara') })
    expect(last().member.cheered).toBe(true)
    expect(mocks.toast).toHaveBeenCalledWith("Cheered Mara's week", expect.objectContaining({ action: 'Undo' }))
    await act(async () => { release({ ok: true }); await done })
    expect(mocks.sendCheer).toHaveBeenCalledWith(body())
    expect(last().member.cheered).toBe(true)
  })

  it('does nothing a second time for a week already cheered', async () => {
    await withProbe()
    await act(async () => { await cheerWeek('g1', 'u-mara') })
    await act(async () => { await cheerWeek('g1', 'u-mara') })
    expect(mocks.sendCheer).toHaveBeenCalledTimes(1)
  })

  it('Undo from the toast turns the pill back and deletes that same cheer', async () => {
    await withProbe()
    await act(async () => { await cheerWeek('g1', 'u-mara') })
    const { onAction } = mocks.toast.mock.calls[0][1]
    await act(async () => { onAction(); await flush() })
    expect(last().member.cheered).toBe(false)
    expect(mocks.undoCheer).toHaveBeenCalledWith(body())
  })

  it('a refused cheer turns the pill back and says so, never "cheered"', async () => {
    await withProbe()
    mocks.sendCheer.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    let ok
    await act(async () => { ok = await cheerWeek('g1', 'u-mara') })
    expect(ok).toBe(false)
    expect(last().member.cheered).toBe(false)
    expect(mocks.toast).toHaveBeenLastCalledWith("Couldn't do that. Try again when you're online.")
  })

  it('a refused Undo puts the cheer back', async () => {
    await withProbe()
    await act(async () => { await cheerWeek('g1', 'u-mara') })
    mocks.undoCheer.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    let ok
    await act(async () => { ok = await undoWeekCheer('g1', 'u-mara') })
    expect(ok).toBe(false)
    expect(last().member.cheered).toBe(true)
  })
})

describe('setMuted', () => {
  it('mutes for this viewer, toasts that they are not told, and Undo unmutes without another toast', async () => {
    await withProbe()
    await act(async () => { await setMuted('g1', 'u-mara', true) })
    expect(mocks.setMute).toHaveBeenCalledWith('g1', 'u-mara', true)
    expect(last().muted).toBe(true)
    expect(mocks.toast).toHaveBeenCalledWith('Muted Mara. They are not told.', expect.objectContaining({ action: 'Undo' }))
    const { onAction } = mocks.toast.mock.calls[0][1]
    await act(async () => { onAction(); await flush() })
    expect(mocks.setMute).toHaveBeenLastCalledWith('g1', 'u-mara', false)
    expect(last().muted).toBe(false)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
  })

  it('unmuting says so, with no Undo', async () => {
    mocks.getGroup.mockResolvedValue({ ...GROUP, members: GROUP.members.map(m => (m.uid === 'u-mara' ? { ...m, muted: true } : m)) })
    await withProbe()
    expect(last().muted).toBe(true)
    await act(async () => { await setMuted('g1', 'u-mara', false) })
    expect(mocks.toast).toHaveBeenCalledWith('Unmuted Mara', undefined)
    expect(last().muted).toBe(false)
  })

  it('a refused mute restores the row', async () => {
    await withProbe()
    mocks.setMute.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    let ok
    await act(async () => { ok = await setMuted('g1', 'u-mara', true) })
    expect(ok).toBe(false)
    expect(last().muted).toBe(false)
  })
})

describe('removeFromGroup', () => {
  it('removes, refetches the groups, and reports the names the group page toasts', async () => {
    await withProbe()
    let names
    await act(async () => { names = await removeFromGroup('g1', 'u-mara') })
    expect(mocks.removeMember).toHaveBeenCalledWith('g1', 'u-mara')
    expect(mocks.refreshFriends).toHaveBeenCalled()
    expect(names).toEqual({ name: 'Mara', groupName: 'Iron Sunday' })
    expect(last().removed).toBe(true)
  })

  it('has no Undo: it toasts nothing itself', async () => {
    await withProbe()
    await act(async () => { await removeFromGroup('g1', 'u-mara') })
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('does not ask the server about a person it just removed, so the page never says "no longer in this group"', async () => {
    await withProbe()
    await act(async () => { await removeFromGroup('g1', 'u-mara') })
    mocks.getMember.mockClear()
    mocks.getMember.mockRejectedValue(gone(404))
    await act(async () => { await refreshMember('g1', 'u-mara') })
    expect(mocks.getMember).not.toHaveBeenCalled()
    expect(last().status).toBe('ready')
  })

  it('throws the refusal and leaves the person in place', async () => {
    await withProbe()
    mocks.removeMember.mockRejectedValue(new FriendsError('no', { status: 403, code: 'forbidden' }))
    await expect(removeFromGroup('g1', 'u-mara')).rejects.toMatchObject({ status: 403 })
    expect(last().removed).toBe(false)
    expect(mocks.refreshFriends).not.toHaveBeenCalled()
  })
})

describe('the mock seam', () => {
  it('shows the fixture, and cheering or muting only changes that copy: no request leaves', async () => {
    const undo = __setMockMember({ groupId: 'g1', uid: 'u-mara', member: MARA, group: GROUP })
    view.render(<Probe />)
    expect(last().member).toBe(MARA)
    await act(async () => { await refreshMember('g1', 'u-mara') })
    await act(async () => { await cheerWeek('g1', 'u-mara') })
    await act(async () => { await setMuted('g1', 'u-mara', true) })
    await act(async () => { await removeFromGroup('g1', 'u-mara') })
    expect(last()).toMatchObject({ muted: true, removed: true })
    expect(last().member.cheered).toBe(true)
    for (const call of [mocks.getMember, mocks.getGroup, mocks.sendCheer, mocks.setMute, mocks.removeMember, mocks.refreshFriends]) expect(call).not.toHaveBeenCalled()
    act(() => undo())
    expect(last().member).toBeNull()
  })
})
