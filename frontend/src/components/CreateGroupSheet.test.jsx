// @vitest-environment happy-dom
// The New group drawer: a name is required, the goal body matches the kind, and success closes the
// drawer's history entry before moving to the group and opening Invite; a refusal toasts and stays.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, type, useView } from '../ds/render.test-util.js'
import { FriendsError } from '../lib/friends/api.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  openSheet: vi.fn(), toast: vi.fn(), createGroup: vi.fn(), refresh: vi.fn(), closeThen: vi.fn(), nav: vi.fn(), invite: vi.fn(),
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet, toast: mocks.toast }) } }))
vi.mock('../lib/friends/api.js', async importActual => ({ ...(await importActual()), createGroup: (...a) => mocks.createGroup(...a) }))
vi.mock('../lib/friends/store.js', () => ({ refreshFriends: (...a) => mocks.refresh(...a) }))
vi.mock('../lib/nav.js', () => ({ closeThen: (...a) => mocks.closeThen(...a), nav: (...a) => mocks.nav(...a) }))
vi.mock('./InviteSheet.jsx', () => ({ inviteSheet: (...a) => mocks.invite(...a) }))

import { createGroupSheet, goalOf } from './CreateGroupSheet.jsx'

const view = useView()
const close = vi.fn()
const field = () => view.host.querySelector('input')
const form = () => view.host.querySelector('form')
const submit = async () => { await act(async () => { form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const radio = name => [...view.host.querySelectorAll('[role="radio"]')].find(r => r.textContent === name)

beforeEach(() => {
  for (const f of Object.values(mocks)) f.mockReset()
  mocks.refresh.mockResolvedValue()
  mocks.closeThen.mockImplementation((c, go) => go(true))
  close.mockReset()
  createGroupSheet()
  view.render(mocks.openSheet.mock.calls[0][0](close))
})

describe('goalOf', () => {
  it('sends n only with a number goal', () => {
    expect(goalOf('planned', 10)).toEqual({ kind: 'planned' })
    expect(goalOf('targets', 10)).toEqual({ kind: 'targets' })
    expect(goalOf('number', 12)).toEqual({ kind: 'number', n: 12 })
  })
})

describe('the New group drawer', () => {
  it('is a plain ds sheet with the three goals, planned chosen', () => {
    expect(mocks.openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
    expect(radio("Everyone's planned sessions").getAttribute('aria-checked')).toBe('true')
    expect(radio('A number we pick').getAttribute('aria-checked')).toBe('false')
    expect(view.host.textContent).toContain('It changes when plans change.')
  })

  it('needs a name: blank says so and sends nothing', async () => {
    type(field(), '   ')
    await submit()
    expect(mocks.createGroup).not.toHaveBeenCalled()
    expect(view.host.textContent).toContain('Give the group a name')
  })

  it('a number goal reveals the stepper and sends n', async () => {
    mocks.createGroup.mockResolvedValue({ id: 'g1', name: 'Crew' })
    click(radio('A number we pick'))
    expect(view.host.querySelector('.g-bstep')).not.toBeNull()
    expect(view.host.textContent).not.toContain('It changes when plans change.')
    type(field(), '  Crew ')
    await submit()
    expect(mocks.createGroup).toHaveBeenCalledWith({ name: 'Crew', goal: { kind: 'number', n: 10 } })
  })

  it('creates, closes its history entry first, goes to the group and opens Invite', async () => {
    mocks.createGroup.mockResolvedValue({ id: 'g1', name: 'Iron Sunday' })
    type(field(), 'Iron Sunday')
    await submit()
    expect(mocks.createGroup).toHaveBeenCalledWith({ name: 'Iron Sunday', goal: { kind: 'planned' } })
    expect(mocks.closeThen).toHaveBeenCalledWith(close, expect.any(Function))
    expect(mocks.nav).toHaveBeenCalledWith('/me/groups/g1', { replace: true })
    expect(mocks.invite).toHaveBeenCalledWith('g1', 'Iron Sunday')
    expect(mocks.closeThen.mock.invocationCallOrder[0]).toBeLessThan(mocks.nav.mock.invocationCallOrder[0])
  })

  it('a refusal toasts its reason and keeps the drawer', async () => {
    mocks.createGroup.mockRejectedValue(new FriendsError('x', { code: 'group-limit', status: 409 }))
    type(field(), 'Iron Sunday')
    await submit()
    expect(mocks.toast).toHaveBeenCalledWith("You're in as many groups as Gains allows. Leave one to make room.")
    expect(mocks.closeThen).not.toHaveBeenCalled()
    expect(mocks.nav).not.toHaveBeenCalled()
  })
})
