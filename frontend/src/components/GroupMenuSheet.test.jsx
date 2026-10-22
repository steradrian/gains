// @vitest-environment happy-dom
// The Group menu and Leave group? (boards Fr2GroupMenu, Fr2Leave): the four rows, Invite and Leave
// as sub-panels of the drawer, What you share here closing the drawer first, the mute switch, and
// Leave calling the server once, then replacing the group's page with Groups and who was left.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'

const mocks = vi.hoisted(() => ({
  sheets: [], toast: vi.fn(), closeThenNav: vi.fn(), closeThenReplace: vi.fn(), invite: vi.fn(),
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: render => { mocks.sheets.push(render) }, toast: mocks.toast }) } }))
vi.mock('../lib/nav.js', () => ({ closeThenNav: (...a) => mocks.closeThenNav(...a), closeThenReplace: (...a) => mocks.closeThenReplace(...a) }))
vi.mock('./InviteSheet.jsx', () => ({ inviteSheet: (...a) => mocks.invite(...a) }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: {}, user: { id: 'u-adrian', name: 'Adrian' } })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../lib/friends/use-group.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, leaveThisGroup: vi.fn(actual.leaveThisGroup) }
})

import { __setMockFriends } from '../lib/friends/store.js'
import { __setMockGroup, groupSnapshot, leaveThisGroup } from '../lib/friends/use-group.js'
import { GROUP, ME_ON } from '../dev/screens/states/friends-fixture.js'
import { GROUP_AS_MEMBER, GROUP_FULL } from '../dev/screens/states/friends-group-fixture.js'
import { groupMenuSheet } from './GroupMenuSheet.jsx'
import { leaveGroupSheet } from './LeaveGroupSheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
let undo = []
const close = vi.fn()
const text = () => view.host.textContent
const row = label => [...view.host.querySelectorAll('button')].find(b => b.textContent.startsWith(label))
const top = () => view.render(mocks.sheets.at(-1)(close))
const open = (group, fn) => {
  undo = [__setMockFriends({ me: ME_ON, groups: [GROUP] }), __setMockGroup(group.id, group)]
  fn(group)
  top()
}

beforeEach(() => {
  mocks.sheets.length = 0
  Object.values(mocks).forEach(m => m.mockClear?.())
  close.mockClear()
  leaveThisGroup.mockClear()
})
afterEach(() => { undo.forEach(fn => fn()); undo = [] })

describe('Group menu (Fr2GroupMenu)', () => {
  it('has Invite, What you share here, Mute notifications and Leave, titled with the group', () => {
    open(GROUP_FULL, groupMenuSheet)
    expect(view.host.querySelector('h2').textContent).toBe('Iron Sunday')
    expect(text()).toContain('Invite to this group')
    expect(text()).toContain('A link, or someone already on Gains')
    expect(text()).toContain('What you share here')
    expect(text()).toContain('Training, consistency, targets')
    expect(text()).toContain('Mute notifications from this group')
    expect(text()).toContain('Leave group')
    expect(text()).toContain('Asks first')
  })

  it('has the same rows for a member who is not the creator', () => {
    open(GROUP_AS_MEMBER, groupMenuSheet)
    for (const label of ['Invite to this group', 'What you share here', 'Mute notifications from this group', 'Leave group']) expect(text()).toContain(label)
  })

  it('Invite opens in the drawer without closing it', () => {
    open(GROUP_FULL, groupMenuSheet)
    click(row('Invite to this group'))
    expect(mocks.invite).toHaveBeenCalledWith(GROUP_FULL.id)
    expect(close).not.toHaveBeenCalled()
  })

  it('What you share here closes the drawer\'s history entry before going to the page', () => {
    open(GROUP_FULL, groupMenuSheet)
    click(row('What you share here'))
    expect(mocks.closeThenNav).toHaveBeenCalledWith(close, '/me/groups/sharing')
  })

  it('the mute switch mutes this group\'s notifications and reads back from the live group', async () => {
    open(GROUP_FULL, groupMenuSheet)
    const sw = view.host.querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await act(async () => { sw.click() })
    expect(groupSnapshot(GROUP_FULL.id).group.muteNotifications).toBe(true)
    expect(view.host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
  })

  it('Leave opens the confirm as another sheet and leaves nothing yet', () => {
    open(GROUP_FULL, groupMenuSheet)
    click(row('Leave group'))
    expect(mocks.sheets).toHaveLength(2)
    expect(leaveThisGroup).not.toHaveBeenCalled()
  })
})

describe('Leave group? (Fr2Leave)', () => {
  it('says what it does: a way back only by new invite, three consequences, Leave group on top and Cancel below', () => {
    open(GROUP_AS_MEMBER, leaveGroupSheet)
    expect(text()).toContain('You can only come back with a new invite.')
    expect([...view.host.querySelectorAll('.g-confirm li')].map(li => li.textContent)).toEqual([
      'Your past workouts stop showing in the group',
      'The group goal drops your planned sessions from this week',
      'Your own data stays exactly as it is',
    ])
    const buttons = [...view.host.querySelectorAll('.g-confirm button')].map(b => b.textContent)
    expect(buttons).toEqual(['Leave group', 'Cancel'])
    expect(view.host.textContent).not.toContain('Undo')
  })

  it('Leave group calls the server once and replaces the page with Groups, naming the group and who invited', async () => {
    open(GROUP_AS_MEMBER, leaveGroupSheet)
    const leave = view.host.querySelector('.g-confirm-danger')
    await act(async () => { leave.click(); leave.click() })
    expect(leaveThisGroup).toHaveBeenCalledTimes(1)
    expect(leaveThisGroup).toHaveBeenCalledWith(GROUP_AS_MEMBER.id)
    expect(mocks.closeThenReplace).toHaveBeenCalledTimes(1)
    expect(mocks.closeThenReplace).toHaveBeenCalledWith(close, '/me/groups', { left: 'Iron Sunday', by: 'Mara' })
  })

  it('leaves no name to say when the viewer created the group', async () => {
    open(GROUP_FULL, leaveGroupSheet)
    await act(async () => { view.host.querySelector('.g-confirm-danger').click() })
    expect(mocks.closeThenReplace).toHaveBeenCalledWith(close, '/me/groups', { left: 'Iron Sunday', by: undefined })
  })

  it('Cancel closes only the confirm and leaves nothing', () => {
    open(GROUP_AS_MEMBER, leaveGroupSheet)
    click([...view.host.querySelectorAll('.g-confirm button')].find(b => b.textContent === 'Cancel'))
    expect(close).toHaveBeenCalledTimes(1)
    expect(leaveThisGroup).not.toHaveBeenCalled()
    expect(mocks.closeThenReplace).not.toHaveBeenCalled()
  })

  it('a refused leave toasts, goes nowhere and can be tried again', async () => {
    open(GROUP_AS_MEMBER, leaveGroupSheet)
    leaveThisGroup.mockRejectedValueOnce(new Error('no'))
    const leave = view.host.querySelector('.g-confirm-danger')
    await act(async () => { leave.click() })
    expect(mocks.toast).toHaveBeenCalledWith("Couldn't do that. Try again when you're online.")
    expect(mocks.closeThenReplace).not.toHaveBeenCalled()
    await act(async () => { leave.click() })
    expect(mocks.closeThenReplace).toHaveBeenCalledTimes(1)
  })
})
