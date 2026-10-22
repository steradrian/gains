// @vitest-environment happy-dom
// The Member menu (board Fr2MemberMenu): Mute and Cheer for everyone, Remove only for the creator
// and never on yourself, Unmute when muted, Mute's toast with an Undo that restores, and Remove
// opening its confirm without closing the menu.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toast: vi.fn(), openSheet: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => ({ user: { id: 'u-adrian' } }) } }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast, openSheet: mocks.openSheet }) } }))
vi.mock('./RemoveMemberSheet.jsx', () => ({ removeMemberSheet: (...a) => mocks.remove(...a) }))

import {
  GROUP_FULL, GROUP_NOT_CREATOR, MEMBER_MARA, MEMBER_SELF, groupWithMuted,
} from '../dev/screens/states/friends-member-fixture.js'
import { __setMockMember, resetMembers } from '../lib/friends/use-member.js'
import { memberMenuSheet } from './MemberMenuSheet.jsx'

const view = useView()
let undo = null
const close = vi.fn()

const open = (member, group) => {
  undo = __setMockMember({ groupId: group.id, uid: member.uid, member, group })
  memberMenuSheet({ group, member })
  const [render] = mocks.openSheet.mock.calls.at(-1)
  view.render(render(close))
}
const rows = () => [...view.host.querySelectorAll('.g-menuitem')]
const row = label => rows().find(r => r.querySelector('b').textContent === label)
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  resetMembers()
  close.mockReset()
  for (const m of Object.values(mocks)) m.mockReset()
})
afterEach(() => { undo?.(); undo = null; resetMembers() })

describe('who sees which rows', () => {
  it('the creator, on another member: Mute, Cheer their week and Remove from group, with the board\'s copy', () => {
    open(MEMBER_MARA, GROUP_FULL)
    expect(rows().map(r => r.querySelector('b').textContent)).toEqual(['Mute Mara', "Cheer Mara's week", 'Remove from group'])
    expect(row('Mute Mara').textContent).toContain("Hides Mara's moments for you. Mara still counts toward the goal and isn't told.")
    expect(row("Cheer Mara's week").textContent).toContain('One cheer for the whole week')
    expect(row('Remove from group').textContent).toContain('Only you see this: you created Iron Sunday. Asks first.')
    expect(row('Remove from group').classList.contains('g-menuitem-danger')).toBe(true)
    expect(view.host.textContent).toContain('No report flow: everyone in a group was invited by someone in it. Mute hides Mara for you; the creator can remove them.')
    expect(view.host.querySelector('h2').textContent).toBe('Mara')
  })

  it('a member who did not create the group has no Remove', () => {
    open(MEMBER_MARA, GROUP_NOT_CREATOR)
    expect(rows().map(r => r.querySelector('b').textContent)).toEqual(['Mute Mara', "Cheer Mara's week"])
  })

  it('never offers Remove on yourself, even as the creator', () => {
    open(MEMBER_SELF, GROUP_FULL)
    expect(row('Remove from group')).toBeUndefined()
  })

  it('has no report or block row: the footer says why', () => {
    open(MEMBER_MARA, GROUP_FULL)
    expect(view.host.textContent).not.toMatch(/report (this|them|her|him)|block/i)
  })
})

describe('Mute', () => {
  it('mutes, closes the menu and toasts that they are not told, with Undo', async () => {
    open(MEMBER_MARA, GROUP_FULL)
    click(row('Mute Mara'))
    expect(close).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Muted Mara. They are not told.', expect.objectContaining({ action: 'Undo' }))
  })

  it('Undo unmutes again: the menu then offers Mute once more', async () => {
    open(MEMBER_MARA, GROUP_FULL)
    click(row('Mute Mara'))
    expect(row('Unmute Mara')).toBeDefined()
    await act(async () => { mocks.toast.mock.calls[0][1].onAction(); await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(row('Mute Mara')).toBeDefined()
    expect(row('Unmute Mara')).toBeUndefined()
  })

  it('a muted member reads Unmute and says what it brings back', () => {
    open(MEMBER_MARA, groupWithMuted(GROUP_FULL, 'u-mara'))
    expect(row('Unmute Mara').textContent).toContain("Brings Mara's moments back.")
    expect(row('Mute Mara')).toBeUndefined()
  })

  it('unmuting toasts without an Undo', async () => {
    open(MEMBER_MARA, groupWithMuted(GROUP_FULL, 'u-mara'))
    click(row('Unmute Mara'))
    await flush()
    expect(mocks.toast).toHaveBeenCalledWith('Unmuted Mara', undefined)
  })
})

describe('Cheer their week', () => {
  it('cheers the week, closes the menu and toasts with Undo', () => {
    open(MEMBER_MARA, GROUP_FULL)
    click(row("Cheer Mara's week"))
    expect(close).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("Cheered Mara's week", expect.objectContaining({ action: 'Undo' }))
  })

  it('a week already cheered is a disabled row that says so', () => {
    open({ ...MEMBER_MARA, cheered: true }, GROUP_FULL)
    expect(row("Cheer Mara's week").disabled).toBe(true)
    expect(row("Cheer Mara's week").textContent).toContain('Cheered this week')
  })
})

describe('Remove from group', () => {
  it('opens the confirm with the group and the person, and leaves the menu open under it', () => {
    open(MEMBER_MARA, GROUP_FULL)
    click(row('Remove from group'))
    expect(close).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith({ group: GROUP_FULL, member: MEMBER_MARA })
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
