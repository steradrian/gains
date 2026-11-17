// @vitest-environment happy-dom
// The two rows Friends adds to other boards: Groups on the Me root (only where Friends exists, a
// "New" mark until it was opened once, the group and its week when in one) and the Friends switch
// in Settings > Features (on opens What you share and sends nothing, off asks first).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ user: { id: 'u1', name: 'Ana' }, confirm: vi.fn(), turnOff: vi.fn(), toast: vi.fn() }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ user: mocks.user }) } }))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/friends/use-friends.js', () => ({ turnOff: (...a) => mocks.turnOff(...a) }))
vi.mock('../settings/confirm-drawer.js', () => ({ confirmDrawer: (...a) => mocks.confirm(...a) }))

import { FriendsError } from '../../lib/friends/api.js'
import { __setMockFriends } from '../../lib/friends/store.js'
import { GROUP, ME_OFF, ME_ON, ME_ON_NO_GROUP } from '../../dev/screens/states/friends-fixture.js'
import { confirmTurnOff, friendsFeatureRow, groupsRow, groupsRowValue, groupsSeen, markGroupsSeen } from './me-rows.js'

let undo = null
const mock = (me, groups) => { undo = __setMockFriends({ me, groups }) }
beforeEach(() => {
  mocks.user = { id: 'u1', name: 'Ana' }
  mocks.confirm.mockReset()
  mocks.turnOff.mockReset().mockResolvedValue()
  mocks.toast.mockReset()
  localStorage.clear()
})
afterEach(() => { undo?.(); undo = null })

describe('the Groups row', () => {
  it('goes to /me/groups with the people icon', () => {
    expect(groupsRow).toMatchObject({ id: 'groups', to: '/me/groups', icon: 'users' })
  })

  it('says its title, the group line and the New tag from the Friends cache', () => {
    mock(ME_ON, [GROUP])
    expect(groupsRow.line()).toEqual({ title: 'Groups', sub: 'Iron Sunday · 17 of 22 this week', tag: 'New' })
  })

  it('shows only where Friends exists', () => {
    expect(groupsRow.visible({})).toBe(true)
    mocks.user = null
    expect(groupsRow.visible({})).toBe(false)
  })

  it('says Better together with no group, and the group with its week when in one', () => {
    mock(ME_ON_NO_GROUP, [])
    expect(groupsRowValue().sub).toBe('Better together')
    undo()
    mock(ME_OFF, [GROUP])
    expect(groupsRowValue().sub).toBe('Better together')
    undo()
    mock(ME_ON, [GROUP])
    expect(groupsRowValue().sub).toBe('Iron Sunday · 17 of 22 this week')
  })

  it('leaves "of M" out when the week has no plan', () => {
    mock(ME_ON, [{ ...GROUP, week: { done: 0, planned: 0 } }])
    expect(groupsRowValue().sub).toBe('Iron Sunday')
  })

  it('carries New until Groups was opened once, remembered on this device', () => {
    expect(groupsRowValue().value).toBe('New')
    markGroupsSeen()
    expect(groupsSeen()).toBe(true)
    expect(groupsRowValue().value).toBeNull()
  })

  it('the gallery\'s mock never reads or writes that memory', () => {
    markGroupsSeen()
    mock(ME_ON, [GROUP])
    expect(groupsRowValue().value).toBe('New')
    localStorage.clear()
    markGroupsSeen()
    expect(localStorage.getItem('gains_friends_groups_seen')).toBeNull()
  })
})

describe('the Friends switch in Features', () => {
  it('is no row where Friends is not available', () => {
    mocks.user = null
    expect(friendsFeatureRow({ nav: vi.fn() })).toEqual([])
  })

  it('reads on/off from /me, and waits while /me has not loaded', () => {
    mock(ME_ON, [GROUP])
    expect(friendsFeatureRow({ nav: vi.fn() })[0]).toMatchObject({ key: 'friends', title: 'Friends', checked: true, disabled: false })
    undo()
    mock(ME_OFF, [])
    expect(friendsFeatureRow({ nav: vi.fn() })[0].checked).toBe(false)
    undo()
    mock(null, [])
    expect(friendsFeatureRow({ nav: vi.fn() })[0]).toMatchObject({ checked: false, disabled: true })
  })

  it('turning on opens What you share first and sends nothing', () => {
    mock(ME_OFF, [])
    const nav = vi.fn()
    friendsFeatureRow({ nav })[0].onChange(true)
    expect(nav).toHaveBeenCalledWith('/me/groups/sharing?first=1')
    expect(mocks.turnOff).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('turning off asks first, with the words of the board, and does nothing until confirmed', () => {
    mock(ME_ON, [GROUP])
    const nav = vi.fn()
    friendsFeatureRow({ nav })[0].onChange(false)
    expect(nav).not.toHaveBeenCalled()
    expect(mocks.turnOff).not.toHaveBeenCalled()
    const ask = mocks.confirm.mock.calls[0][0]
    expect(ask.title).toBe('Stop sharing everywhere?')
    expect(ask.body).toBe('Nothing is shared and nobody sees you in a group.')
    expect(ask.confirmLabel).toBe('Turn off Friends')
  })

  it('confirming turns Friends off; a failure is toasted in one line', async () => {
    mock(ME_ON, [GROUP])
    friendsFeatureRow({ nav: vi.fn() })[0].onChange(false)
    const { onConfirm } = mocks.confirm.mock.calls[0][0]
    await onConfirm()
    expect(mocks.turnOff).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
    mocks.turnOff.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await onConfirm()
    expect(mocks.toast).toHaveBeenCalledWith("Couldn't do that. Try again when you're online.")
  })
})

// Friends surfaces m1: the Today card's menu opens this same confirm and closes itself with onDone.
describe('confirmTurnOff from another host', () => {
  it('runs onDone once Friends is off, and not when turning it off failed', async () => {
    const onDone = vi.fn()
    confirmTurnOff({ onDone })
    const { onConfirm } = mocks.confirm.mock.calls[0][0]
    await onConfirm()
    expect(onDone).toHaveBeenCalledTimes(1)
    mocks.turnOff.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await onConfirm()
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
  })
})
