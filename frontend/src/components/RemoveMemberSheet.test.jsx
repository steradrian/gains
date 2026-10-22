// @vitest-environment happy-dom
// Remove from group? (board Fr2Remove, R5): the arithmetic of the goal and its line left out when a
// figure is unknown, Remove on top and Cancel low, no Undo, the tap going once, success replacing
// the Member page by the group with route state, and a refusal staying with a toast.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), openSheet: vi.fn(), remove: vi.fn(), refreshMember: vi.fn(), closeThenReplace: vi.fn(), closeThen: vi.fn(),
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../store/useStore.js', () => {
  const state = { user: { id: 'u-adrian' }, S: {} }
  return { useStore: Object.assign(selector => selector(state), { getState: () => state }) }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast, openSheet: mocks.openSheet }) } }))
vi.mock('../lib/friends/use-member.js', () => ({
  removeFromGroup: (...a) => mocks.remove(...a),
  refreshMember: (...a) => mocks.refreshMember(...a),
}))
vi.mock('../lib/nav.js', () => ({
  closeThenReplace: (...a) => mocks.closeThenReplace(...a),
  closeThen: (...a) => mocks.closeThen(...a),
}))
vi.mock('../views/friends/me-rows.js', () => ({ GROUPS_PATH: '/me/groups' }))

import { FriendsError } from '../lib/friends/api.js'
import { GROUP_FULL, MEMBER_MARA, MEMBER_VLAD_GAP } from '../dev/screens/states/friends-member-fixture.js'
import { removeMemberSheet } from './RemoveMemberSheet.jsx'

const view = useView()
const close = vi.fn()

const open = (member = MEMBER_MARA, group = GROUP_FULL) => {
  removeMemberSheet({ group, member })
  const [render, opts] = mocks.openSheet.mock.calls.at(-1)
  view.render(render(close))
  return opts
}
const items = () => [...view.host.querySelectorAll('.g-confirm li')].map(li => li.textContent)
const buttons = () => [...view.host.querySelectorAll('.g-confirm > button')]
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  close.mockReset()
  for (const m of Object.values(mocks)) m.mockReset()
  mocks.remove.mockResolvedValue({ name: 'Mara', groupName: 'Iron Sunday' })
})

describe('the confirm', () => {
  it('asks first, with Remove on top and Cancel low, and says she can only come back with a new invite', () => {
    open()
    expect(view.host.querySelector('h2').textContent).toBe('Remove from group?')
    expect(view.host.querySelector('.g-confirm p').textContent).toBe('Mara can only come back with a new invite.')
    expect(buttons().map(b => b.textContent)).toEqual(['Remove Mara', 'Cancel'])
    expect(buttons()[0].classList.contains('g-confirm-danger')).toBe(true)
    expect(buttons()[0].classList.contains('g-haptic')).toBe(true)
  })

  it('lists the three consequences, with the goal arithmetic: 22 becomes 18', () => {
    open()
    expect(items()).toEqual([
      'Their moments and past workouts stop showing in the group',
      'The group goal drops their 4 planned sessions: 22 becomes 18',
      'They see they are no longer in the group; their own data stays as it is',
    ])
  })

  it('leaves the goal line out when the person has no plan or the group figure is unknown', () => {
    open(MEMBER_VLAD_GAP)
    expect(items()).toHaveLength(2)
    expect(items().join(' ')).not.toContain('planned sessions')
    open(MEMBER_MARA, { ...GROUP_FULL, week: undefined })
    expect(items()).toHaveLength(2)
  })

  it('is opened as a plain sheet, so from the menu it is a sub-panel', () => {
    const opts = open()
    expect(opts).toEqual({ variant: 'ds' })
  })

  it('has no Undo anywhere', () => {
    open()
    expect(view.host.textContent).not.toContain('Undo')
  })

  it('Cancel closes only this panel and removes nobody', () => {
    open()
    click(buttons()[1])
    expect(close).toHaveBeenCalledTimes(1)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.closeThenReplace).not.toHaveBeenCalled()
  })
})

describe('Remove', () => {
  it('removes once however often it is tapped, then replaces the page by the group with the route state', async () => {
    open()
    await act(async () => { buttons()[0].click(); buttons()[0].click() })
    await flush()
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledWith('g-iron-sunday', 'u-mara')
    expect(mocks.closeThenReplace).toHaveBeenCalledWith(close, '/me/groups/g-iron-sunday', { removed: 'Mara', group: 'Iron Sunday' })
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('a creator-only refusal (403) stays on the page with a toast', async () => {
    mocks.remove.mockRejectedValue(new FriendsError('no', { status: 403, code: 'forbidden' }))
    open()
    await act(async () => { buttons()[0].click() })
    await flush()
    expect(mocks.closeThenReplace).not.toHaveBeenCalled()
    const [, after] = mocks.closeThen.mock.calls[0]
    after()
    expect(mocks.toast).toHaveBeenCalledWith('Only the person who created Iron Sunday can remove people.')
  })

  it('a person already gone (404) lets the page find that out and leave by itself', async () => {
    mocks.remove.mockRejectedValue(new FriendsError('gone', { status: 404, code: 'not-found' }))
    open()
    await act(async () => { buttons()[0].click() })
    await flush()
    const [, after] = mocks.closeThen.mock.calls[0]
    after()
    expect(mocks.refreshMember).toHaveBeenCalledWith('g-iron-sunday', 'u-mara')
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(mocks.closeThenReplace).not.toHaveBeenCalled()
  })

  it('anything else says it could not be done', async () => {
    mocks.remove.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    open()
    await act(async () => { buttons()[0].click() })
    await flush()
    mocks.closeThen.mock.calls[0][1]()
    expect(mocks.toast).toHaveBeenCalledWith("Couldn't do that. Try again when you're online.")
  })
})
