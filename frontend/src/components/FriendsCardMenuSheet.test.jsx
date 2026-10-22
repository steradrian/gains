// @vitest-environment happy-dom
// The Today Friends card's options (T1.17): Hide this card stores that the moment was seen and
// closes, Open <group> closes its history entry then goes to the group, and Turn off Friends is a
// different row that opens the same confirm the Features switch uses and closes the menu only
// once Friends is off.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ openSheet: vi.fn(), closeThenNav: vi.fn(), confirmTurnOff: vi.fn() }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet }) } }))
vi.mock('../lib/nav.js', () => ({ closeThenNav: (...a) => mocks.closeThenNav(...a) }))
vi.mock('../views/friends/me-rows.js', () => ({ GROUPS_PATH: '/me/groups', confirmTurnOff: (...a) => mocks.confirmTurnOff(...a) }))
vi.mock('../lib/friends/card-seen.js', () => ({ markCardSeen: vi.fn() }))

import { markCardSeen } from '../lib/friends/card-seen.js'
import { GROUP } from '../dev/screens/states/friends-fixture.js'
import { friendsCardMenuSheet } from './FriendsCardMenuSheet.jsx'

const view = useView()
const close = vi.fn()
const AT = Date.parse('2026-10-22T10:00:00Z')
const row = label => [...view.host.querySelectorAll('.g-menuitem')].find(b => b.querySelector('b').textContent === label)

beforeEach(() => {
  for (const f of [mocks.openSheet, mocks.closeThenNav, mocks.confirmTurnOff, markCardSeen, close]) f.mockReset()
  friendsCardMenuSheet(GROUP, { uid: 'u1', at: AT })
  view.render(mocks.openSheet.mock.calls[0][0](close))
})

describe('the Friends card menu', () => {
  it('is a plain ds sheet with the three rows of the board and their lines', () => {
    expect(mocks.openSheet.mock.calls[0][1]).toEqual({ variant: 'ds' })
    expect(view.host.querySelector('h2').textContent).toBe('Friends')
    expect([...view.host.querySelectorAll('.g-menuitem b')].map(b => b.textContent)).toEqual(['Hide this card', 'Open Iron Sunday', 'Turn off Friends'])
    expect(row('Hide this card').textContent).toContain('Until something new happens')
    expect(row('Open Iron Sunday').textContent).toContain('17 of 22 this week')
    expect(row('Turn off Friends').textContent).toContain('Stops sharing everywhere. Asks first')
  })

  it('Turn off is the only danger row, and Hide is not Turn off', () => {
    expect(row('Turn off Friends').classList.contains('g-menuitem-danger')).toBe(true)
    expect(row('Hide this card').classList.contains('g-menuitem-danger')).toBe(false)
  })

  it('Hide marks the moment seen (never earlier than it) and closes, turning nothing off', () => {
    click(row('Hide this card'))
    expect(markCardSeen).toHaveBeenCalledWith('u1', expect.any(Number))
    expect(markCardSeen.mock.calls[0][1]).toBeGreaterThanOrEqual(AT)
    expect(close).toHaveBeenCalledTimes(1)
    expect(mocks.confirmTurnOff).not.toHaveBeenCalled()
  })

  it('Open closes the drawer\'s history entry first, then goes to the group', () => {
    click(row('Open Iron Sunday'))
    expect(mocks.closeThenNav).toHaveBeenCalledWith(close, '/me/groups/g-iron-sunday')
    expect(markCardSeen).toHaveBeenCalledTimes(1)
  })

  it('Turn off goes through the confirm and closes the menu only when Friends is off', () => {
    click(row('Turn off Friends'))
    expect(mocks.confirmTurnOff).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
    mocks.confirmTurnOff.mock.calls[0][0].onDone()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
