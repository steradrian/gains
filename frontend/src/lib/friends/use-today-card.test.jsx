// @vitest-environment happy-dom
// The Today Friends card: never an empty card (off, no group, nothing new, hidden, still loading),
// Hide holds until a newer moment, opening the group marks it seen, the menu gets who and when,
// and Cheer is optimistic with an Undo that takes exactly that cheer back.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ nav: vi.fn(), toast: vi.fn(), send: vi.fn(), undo: vi.fn(), menu: vi.fn(), user: { id: 'u-adrian', name: 'Adrian' } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../components/FriendsCardMenuSheet.jsx', () => ({ friendsCardMenuSheet: (...a) => mocks.menu(...a) }))
vi.mock('./api.js', async importActual => ({
  ...(await importActual()),
  sendCheer: (...a) => mocks.send(...a),
  undoCheer: (...a) => mocks.undo(...a),
}))

import { FriendsError } from './api.js'
import { __resetCardSeen, markCardSeen, readCardSeen } from './card-seen.js'
import { __setMockFriends } from './store.js'
import { cardOf, groupLineOf, momentLine, useTodayCard } from './use-today-card.js'
import { ME_NEW_CHEERED, ME_NEW_ONE, ME_NEW_TWO, ME_NOTHING_NEW } from '../../dev/screens/states/friends-surfaces-fixture.js'
import { GROUP, ME_OFF, ME_ON_NO_GROUP } from '../../dev/screens/states/friends-fixture.js'

const view = useView()
let undoMock = null
let card
function Probe() { card = useTodayCard(); return null }

const show = async (me, groups = [GROUP]) => {
  undoMock = __setMockFriends({ me, groups })
  await act(async () => { view.root.render(<Probe />) })
}

beforeEach(() => {
  card = undefined
  mocks.nav.mockReset()
  mocks.toast.mockReset()
  mocks.menu.mockReset()
  mocks.send.mockReset().mockResolvedValue({ ok: true })
  mocks.undo.mockReset().mockResolvedValue({ ok: true })
  __resetCardSeen()
})
afterEach(() => { undoMock?.(); undoMock = null })

describe('cardOf: never an empty card', () => {
  it('is null for Friends off, no group, nothing new, and no answer yet', () => {
    expect(cardOf(ME_OFF, [GROUP], 0)).toBeNull()
    expect(cardOf(ME_ON_NO_GROUP, [], 0)).toBeNull()
    expect(cardOf(ME_NOTHING_NEW, [GROUP], 0)).toBeNull()
    expect(cardOf(null, null, 0)).toBeNull()
  })

  it('is null when the newest moment is in a group the person is no longer in, or has nothing to say', () => {
    expect(cardOf(ME_NEW_ONE, [{ ...GROUP, id: 'other' }], 0)).toBeNull()
    expect(cardOf({ ...ME_NEW_ONE, newest: { ...ME_NEW_ONE.newest, moments: [{ id: 'x', kind: 'workout', names: [] }] } }, [GROUP], 0)).toBeNull()
    expect(cardOf({ ...ME_NEW_ONE, newCount: 0 }, [GROUP], 0)).toBeNull()
  })

  it('is null once the newest moment is not newer than the last Hide or open', () => {
    const at = Date.parse(ME_NEW_ONE.newest.at)
    expect(cardOf(ME_NEW_ONE, [GROUP], at - 1)).not.toBeNull()
    expect(cardOf(ME_NEW_ONE, [GROUP], at)).toBeNull()
  })

  it('shows at most two moments', () => {
    const three = { ...ME_NEW_TWO, newest: { ...ME_NEW_TWO.newest, moments: [...ME_NEW_TWO.newest.moments, { id: 'm3', kind: 'together', names: ['Ioana', 'Vlad'] }] } }
    expect(cardOf(three, [GROUP], 0).moments).toHaveLength(2)
  })
})

describe('the lines', () => {
  it('builds one sentence per moment from translated parts', () => {
    expect(momentLine({ kind: 'workout', names: ['Mara'], title: 'Legs' })).toBe('Mara finished Legs')
    expect(momentLine({ kind: 'workout', names: ['Mara'] })).toBe('Mara finished a workout')
    expect(momentLine({ kind: 'best', names: ['Radu'] })).toBe('Radu set a new best')
    expect(momentLine({ kind: 'together', names: ['Ioana', 'Vlad'] })).toBe('Ioana and Vlad trained together')
    expect(momentLine({ kind: 'target', names: ['Vlad'] })).toBe('Vlad reached their targets')
  })

  it('the group line takes its numbers from the group and drops "of M" without a plan', () => {
    expect(groupLineOf(GROUP)).toBe('Iron Sunday · 17 of 22 this week')
    expect(groupLineOf({ ...GROUP, week: { done: 0, planned: 0 } })).toBe('Iron Sunday')
  })
})

describe('useTodayCard', () => {
  it('is null while Friends is off, there is no group, nothing is new, or /me has not answered', async () => {
    for (const [me, groups] of [[ME_OFF, []], [ME_ON_NO_GROUP, []], [ME_NOTHING_NEW, [GROUP]], [null, []]]) {
      await show(me, groups)
      expect(card).toBeNull()
      undoMock()
    }
  })

  it('gives the line, the group line, the people and the labels', async () => {
    await show(ME_NEW_TWO)
    expect(card.line).toBe('Mara finished Legs · Radu set a new best')
    expect(card.groupLine).toBe('Iron Sunday · 17 of 22 this week')
    expect(card.avatars.map(a => a.initial)).toEqual(['Mara', 'Radu'])
    expect(card.cheered).toBe(false)
    expect(card.labels).toEqual({ cheer: 'Cheer', cheered: 'Cheered', menu: 'Friends card options' })
  })

  it('reads a cheer the server already has', async () => {
    await show(ME_NEW_CHEERED)
    expect(card.cheered).toBe(true)
  })

  it('Open goes to the group and the card is gone after (marked seen)', async () => {
    await show(ME_NEW_ONE)
    await act(async () => { card.onOpen() })
    expect(mocks.nav).toHaveBeenCalledWith('/me/groups/g-iron-sunday')
    expect(card).toBeNull()
    expect(readCardSeen('u-adrian')).toBeGreaterThan(0)
  })

  it('a Hide holds until something newer arrives, then the card is back', async () => {
    await show(ME_NEW_ONE)
    await act(async () => { markCardSeen('u-adrian', Date.now()) })
    expect(card).toBeNull()
    undoMock()
    const later = { ...ME_NEW_ONE, newest: { ...ME_NEW_ONE.newest, at: new Date(Date.now() + 60000).toISOString() } }
    await show(later)
    expect(card).not.toBeNull()
  })

  it('the menu gets the group, who is looking and when the newest moment was', async () => {
    await show(ME_NEW_ONE)
    card.onMenu()
    expect(mocks.menu).toHaveBeenCalledWith(GROUP, { uid: 'u-adrian', at: Date.parse(ME_NEW_ONE.newest.at) })
  })
})

describe('Cheer from the card', () => {
  const BODY = { group: 'g-iron-sunday', kind: 'moment', ref: 'm-legs' }

  it('turns the pill at once, sends that moment and offers Undo', async () => {
    await show(ME_NEW_ONE)
    await act(async () => { card.onCheer() })
    expect(card.cheered).toBe(true)
    expect(mocks.send).toHaveBeenCalledWith(BODY)
    expect(mocks.toast).toHaveBeenCalledWith('Cheered Mara', expect.objectContaining({ action: 'Undo' }))
  })

  it('Undo puts the pill back and takes back exactly that cheer', async () => {
    await show(ME_NEW_ONE)
    await act(async () => { card.onCheer() })
    await act(async () => { await mocks.toast.mock.calls[0][1].onAction() })
    expect(card.cheered).toBe(false)
    expect(mocks.undo).toHaveBeenCalledWith(BODY)
  })

  it('a refused cheer puts the pill back and says so in one line', async () => {
    mocks.send.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await show(ME_NEW_ONE)
    await act(async () => { card.onCheer() })
    expect(card.cheered).toBe(false)
    expect(mocks.toast).toHaveBeenLastCalledWith("Couldn't do that. Try again when you're online.")
  })

  it('an Undo the server cannot take leaves the cheer standing', async () => {
    mocks.undo.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await show(ME_NEW_ONE)
    await act(async () => { card.onCheer() })
    await act(async () => { await mocks.toast.mock.calls[0][1].onAction() })
    expect(card.cheered).toBe(true)
    expect(mocks.toast).toHaveBeenLastCalledWith("Couldn't do that. Try again when you're online.")
  })

  it('an Undo of a cheer that never went takes nothing back', async () => {
    mocks.send.mockRejectedValue(new FriendsError('x', { code: 'offline' }))
    await show(ME_NEW_ONE)
    await act(async () => { card.onCheer() })
    await act(async () => { await mocks.toast.mock.calls[0][1].onAction() })
    expect(mocks.undo).not.toHaveBeenCalled()
  })
})
