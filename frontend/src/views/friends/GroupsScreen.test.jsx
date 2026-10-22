// @vitest-environment happy-dom
// Groups (boards Fr6Off, Fr1Groups, Fr1Empty, Fr1Left): each state draws its parts, the preview
// shows only what the switches allow, turning on goes to What you share first, and the "you left"
// notice is said once and cleared from the history entry.
import { act } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'

const mocks = vi.hoisted(() => ({ toast: vi.fn(), createGroup: vi.fn(), joinSheet: vi.fn(), S: null, user: { id: 'u1', name: 'Adrian' } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../components/CreateGroupSheet.jsx', () => ({ createGroupSheet: (...a) => mocks.createGroup(...a) }))
vi.mock('./join-link-sheet.jsx', () => ({ joinLinkSheet: (...a) => mocks.joinSheet(...a) }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))

import { __setMockFriends, __setMockStale } from '../../lib/friends/store.js'
import { GROUP, GROUP_QUIET, ME_OFF, ME_ON, ME_ON_NO_GROUP, PREVIEW_STATE } from '../../dev/screens/states/friends-fixture.js'
import GroupsScreen from './GroupsScreen.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
let undo = null
let here = null
function Probe() { here = useLocation(); return null }

const show = (me, groups, entry = '/me/groups') => {
  undo = __setMockFriends({ me, groups })
  view.render(<MemoryRouter initialEntries={[entry]}><GroupsScreen /><Probe /></MemoryRouter>)
}
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button, a')].find(b => b.textContent.includes(label))

beforeEach(() => {
  mocks.S = PREVIEW_STATE
  mocks.toast.mockClear()
  mocks.createGroup.mockClear()
  mocks.joinSheet.mockClear()
})
afterEach(() => { undo?.(); undo = null })

describe('Friends off (Fr6Off)', () => {
  it('says Friends is off, offers Turn on Friends and lists what Friends adds', () => {
    show(ME_OFF, [])
    expect(view.host.querySelector('h1').textContent).toBe('Groups')
    expect(text()).toContain('Friends · off')
    expect(text()).toContain('Friends is off')
    expect(text()).toContain('Turning it on asks what to share before anything goes out.')
    for (const part of ['With Friends on', 'One weekly goal you fill together', 'One tap, no comments', 'Opt-in, short, never ranked']) expect(text()).toContain(part)
    expect(text()).not.toContain('What you share')
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
  })

  it('Turn on Friends goes to What you share first and sends nothing', () => {
    show(ME_OFF, [])
    click(button('Turn on Friends'))
    expect(here.pathname + here.search).toBe('/me/groups/sharing?first=1')
  })
})

describe('Groups with a group (Fr1Groups)', () => {
  it('draws the group card, the two actions, and What you share with the preview', () => {
    show(ME_ON, [GROUP])
    expect(text()).toContain('Friends · on')
    expect(text()).toContain('Iron Sunday')
    expect(text()).toContain('17 of 22 sessions this week · 4-week streak')
    expect(text()).toContain('Everyone trains 3× this week · 12 of 15')
    expect([...view.host.querySelectorAll('.g-mavatar')].map(a => a.textContent)).toEqual(['A', 'M', 'R', 'I', 'V'])
    expect(text()).toContain('Join with an invite link')
    expect(text()).toContain('Create a group')
    expect(text()).toContain('What you share')
    expect(text()).toContain('What friends see')
    expect(text()).toContain('Training done')
    expect(text()).toContain('4 of 4 planned workouts')
    expect(text()).toContain('Never shared: weight, foods, what you ate, photos')
  })

  it('opens the group, the paste sheet, the create drawer and the editor', () => {
    show(ME_ON, [GROUP])
    click(button('Iron Sunday'))
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
    show(ME_ON, [GROUP])
    click(button('Join with an invite link'))
    expect(mocks.joinSheet).toHaveBeenCalledTimes(1)
    click(button('Create a group'))
    expect(mocks.createGroup).toHaveBeenCalledTimes(1)
    click(button('Edit'))
    expect(here.pathname).toBe('/me/groups/sharing')
  })

  it('leaves out what the data cannot back: a quiet group has no sessions line, no streak, no challenge', () => {
    show(ME_ON, [GROUP_QUIET])
    expect(text()).toContain('Sunday crew')
    expect(text()).not.toMatch(/sessions this week|-week streak|Everyone trains/)
  })

  it('lists every group, one card each', () => {
    show(ME_ON, [GROUP, GROUP_QUIET])
    expect(view.host.querySelectorAll('.g-fgroups .g-grow')).toHaveLength(2)
  })

  it('shows only what the switches allow', () => {
    show({ ...ME_ON, share: { training: false, consistency: false, targets: false, bests: false } }, [GROUP])
    expect(text()).not.toContain('Training done')
    expect(text()).not.toContain('planned workouts')
    expect(text()).not.toContain('Food targets')
    expect(text()).toContain('New bests')
  })

  it('keeps the last update and says the server is out of reach', () => {
    show(ME_ON, [GROUP])
    expect(text()).not.toContain("Can't reach the server")
    act(() => __setMockStale())
    expect(text()).toContain("Can't reach the server, showing the last update")
    expect(text()).toContain('Iron Sunday')
  })
})

describe('On, no group yet (Fr1Empty)', () => {
  it('says Better together, offers Create a group and Join, and shows what friends would see', () => {
    show(ME_ON_NO_GROUP, [])
    expect(text()).toContain('Friends is on · nothing shared until you join')
    expect(text()).toContain('Better together')
    expect(text()).toContain('Nobody is ranked; everyone just fills the same ring.')
    click(button('Create a group'))
    expect(mocks.createGroup).toHaveBeenCalledTimes(1)
    click(button('Join with an invite link'))
    expect(mocks.joinSheet).toHaveBeenCalledTimes(1)
    expect(text()).toContain('What friends would see')
    expect(text()).toContain('Training done')
  })
})

describe('After leaving (Fr1Left)', () => {
  const left = { pathname: '/me/groups', state: { left: 'Iron Sunday', by: 'Mara' } }

  it('says No group right now and who to ask, and toasts once', () => {
    show(ME_ON_NO_GROUP, [], left)
    expect(text()).toContain('No group right now')
    expect(text()).toContain('You left Iron Sunday. Ask Mara for a new invite to go back, or start your own.')
    expect(text()).toContain('Join with an invite link')
    expect(text()).toContain('What you share')
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast.mock.calls[0][0]).toBe('You left Iron Sunday')
    expect(mocks.toast.mock.calls[0][1].action).toBe('OK')
  })

  it('clears the route state after the first render, so it is not said again', () => {
    show(ME_ON_NO_GROUP, [], left)
    expect(here.state).toBeNull()
    expect(text()).toContain('No group right now')
    undo()
    undo = __setMockFriends({ me: ME_ON_NO_GROUP, groups: [] })
    mocks.toast.mockClear()
    view.render(<MemoryRouter key="reopened" initialEntries={['/me/groups']}><GroupsScreen /><Probe /></MemoryRouter>)
    expect(text()).toContain('Better together')
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('without the person who invited them, the line asks for a new invite without a name', () => {
    show(ME_ON_NO_GROUP, [], { pathname: '/me/groups', state: { left: 'Iron Sunday' } })
    expect(text()).toContain('You left Iron Sunday. Ask for a new invite to go back, or start your own.')
  })
})
