// @vitest-environment happy-dom
// The Group page (boards Fr2Group, Fr2Cheered, Fr2NoActivity, Fr2Muted): each state draws its
// parts, Cheer turns the pill and offers Undo, the mute banner has Unmute, Trained together can be
// removed, lines the data cannot back are left out, and a 404 leaves for Groups with a toast.
import { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), groupMenu: vi.fn(), newChallenge: vi.fn(), invite: vi.fn(), momentMenu: vi.fn(), user: { id: 'u-adrian', name: 'Adrian' },
}))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: {}, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../components/GroupMenuSheet.jsx', () => ({ groupMenuSheet: (...a) => mocks.groupMenu(...a) }))
vi.mock('../../components/NewChallengeSheet.jsx', () => ({ newChallengeSheet: (...a) => mocks.newChallenge(...a) }))
vi.mock('../../components/InviteSheet.jsx', () => ({ inviteSheet: (...a) => mocks.invite(...a) }))
vi.mock('../../components/MomentMenuSheet.jsx', () => ({ momentMenuSheet: (...a) => mocks.momentMenu(...a) }))

import { __setMockFriends } from '../../lib/friends/store.js'
import { __setMockGroup } from '../../lib/friends/use-group.js'
import { GROUP, ME_ON } from '../../dev/screens/states/friends-fixture.js'
import {
  GROUP_ALONE, GROUP_FULL, GROUP_GAP_WEEK, GROUP_MUTED, GROUP_NO_ACTIVITY, GROUP_OVER_GOAL,
} from '../../dev/screens/states/friends-group-fixture.js'
import GroupScreen from './GroupScreen.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
let undo = []
let here = null
function Probe() { here = useLocation(); return null }

const show = (group, status) => {
  undo = [__setMockFriends({ me: ME_ON, groups: [GROUP] }), __setMockGroup(GROUP.id, group, { status })]
  view.render(
    <MemoryRouter initialEntries={['/me/groups/' + GROUP.id]}>
      <Routes>
        <Route path="/me/groups/:id" element={<GroupScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  )
}
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button, a')].find(b => b.textContent === label || b.getAttribute('aria-label') === label)
const lastToast = () => mocks.toast.mock.calls.at(-1)

beforeEach(() => { mocks.toast.mockClear(); mocks.groupMenu.mockClear(); mocks.newChallenge.mockClear(); mocks.invite.mockClear(); mocks.momentMenu.mockClear() })
afterEach(() => { undo.forEach(fn => fn()); undo = [] })

describe('the group (Fr2Group)', () => {
  it('draws the header, the ring with its centre, the lines, the legend, the week together, a challenge and the moments', () => {
    show(GROUP_FULL)
    expect(view.host.querySelector('h1').textContent).toBe('Iron Sunday')
    expect(text()).toMatch(/5 friends · since /)
    expect(view.host.querySelector('.g-mring').getAttribute('aria-label')).toBe('17 of 22 planned sessions')
    expect(view.host.querySelector('.g-gweek-num').textContent).toBe('17 / 22')
    expect(text()).toContain('planned sessions')
    expect(text()).toContain('5 of 7 targets hit')
    expect(text()).toContain('4-week streak')
    expect([...view.host.querySelectorAll('.g-glegend li')].map(li => li.textContent)).toEqual(
      ['AYou4 of 4', 'MMara3 of 4', 'RRadu4 of 5', 'IIoana3 of 4', 'VVlad3 of 5'])
    expect(text()).toContain('This week together')
    expect(text()).toContain('4 weeks hit')
    expect(text()).toContain('Dots are workouts logged that day by anyone in the group.')
    expect(text()).toContain('Everyone trains 3× this week')
    expect(text()).toContain('Joined 12 of 15 workouts')
    expect(text()).toContain('Mara finished Legs')
    expect(text()).toContain('NEW BEST')
    expect(text()).toContain('One tap cheers. No comments, no counts of likes. Moments go after 7 days.')
  })

  it('draws a segment per member and never a warning colour', () => {
    show(GROUP_FULL)
    expect(view.host.querySelectorAll('.g-mring-val')).toHaveLength(5)
    expect(view.host.querySelector('.g-mring-over')).toBeNull()
  })

  it('leaves the streak and targets lines out when the data has none, and "since" out without a date', () => {
    show({ ...GROUP_FULL, streak: 0, targets: undefined, since: undefined })
    expect(text()).not.toContain('streak')
    expect(text()).not.toContain('targets hit')
    expect(text()).not.toContain('weeks hit')
    expect(text()).not.toContain('since')
    expect(text()).toContain('5 friends')
  })

  it('keeps the ring calm past the goal (19 / 17) and reads "No plan" for a week off with no segment', () => {
    show(GROUP_OVER_GOAL)
    expect(view.host.querySelector('.g-gweek-num').textContent).toBe('19 / 17')
    undo.forEach(fn => fn()); act(() => view.root.render(null))
    show(GROUP_GAP_WEEK)
    expect(text()).toContain('No plan')
    expect(view.host.querySelectorAll('.g-mring-val')).toHaveLength(4)
  })

  it('opens the Group menu from the ⋯ in the bar', () => {
    show(GROUP_FULL)
    click(button('Group options'))
    expect(mocks.groupMenu).toHaveBeenCalledTimes(1)
    expect(mocks.groupMenu.mock.calls[0][0].id).toBe(GROUP.id)
  })

  it('New opens the new challenge drawer for this group, and a challenge opens its page', () => {
    show(GROUP_FULL)
    click(button('New'))
    expect(mocks.newChallenge).toHaveBeenCalledWith(GROUP.id)
    click([...view.host.querySelectorAll('button')].find(b => b.textContent.includes('Everyone trains 3×')))
    expect(here.pathname).toBe(`/me/groups/${GROUP.id}/challenge/c-trains-3`)
  })

  it('links "3 cheers for you" to the cheers page', () => {
    show(GROUP_FULL)
    click(button('3 cheers for you'))
    expect(here.pathname).toBe('/me/groups/cheers')
  })
})

describe('cheer (Fr2Cheered)', () => {
  it('turns the pill to Cheered and toasts "Cheered Mara\'s Legs" with Undo', async () => {
    show(GROUP_FULL)
    const before = [...view.host.querySelectorAll('.g-mrow-on')].length
    await act(async () => { button('Cheer Mara finished Legs').click() })
    expect(view.host.querySelectorAll('.g-mrow-on')).toHaveLength(before + 1)
    expect(button('Cheer Mara finished Legs')).toBeUndefined()
    const [msg, opts] = lastToast()
    expect(msg).toBe("Cheered Mara's Legs")
    expect(opts.action).toBe('Undo')
  })

  it('Undo brings the Cheer pill back exactly', async () => {
    show(GROUP_FULL)
    await act(async () => { button('Cheer Mara finished Legs').click() })
    await act(async () => { lastToast()[1].onAction() })
    expect(button('Cheer Mara finished Legs').textContent).toBe('Cheer')
    expect(view.host.querySelectorAll('.g-mrow-on')).toHaveLength(GROUP_FULL.moments.filter(m => m.cheered).length)
  })

  it('has no Cheer pill on your own moments', () => {
    show({ ...GROUP_FULL, moments: [{ ...GROUP_FULL.moments[0], mine: true }] })
    expect(view.host.querySelector('.g-mrow .g-btn')).toBeNull()
  })
})

describe('Trained together', () => {
  it('has a ⋯ that offers removal, and removing drops the moment', async () => {
    show(GROUP_FULL)
    expect(view.host.querySelectorAll('.g-iconbtn')).toHaveLength(1)
    click(view.host.querySelector('.g-iconbtn'))
    const [title, remove] = mocks.momentMenu.mock.calls[0]
    expect(title).toBe('You and Ioana trained together')
    await act(async () => { remove() })
    expect(text()).not.toContain('You and Ioana trained together')
  })
})

describe('a muted member (Fr2Muted)', () => {
  it('shows the banner with Unmute, their moments already gone, and they still count in the ring', () => {
    show(GROUP_MUTED)
    expect(text()).toContain('You muted Vlad. Their moments are hidden; they still count toward the goal.')
    expect(button('Unmute')).toBeDefined()
    expect(text()).not.toContain('Vlad hit his protein target')
    expect(view.host.querySelector('.g-gweek-num').textContent).toBe('17 / 22')
    expect(text()).toContain('Vlad')
  })

  it('Unmute takes the banner away without a toast', async () => {
    show(GROUP_MUTED)
    await act(async () => { button('Unmute').click() })
    expect(text()).not.toContain('You muted Vlad')
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

describe('quiet and alone (Fr2NoActivity)', () => {
  it('a new week shows New week, 0 / 22, the streak as weeks in a row and Quiet so far in place of moments', () => {
    show(GROUP_NO_ACTIVITY)
    expect(text()).toContain('New week')
    expect(view.host.querySelector('.g-gweek-num').textContent).toBe('0 / 22')
    expect(text()).toContain('Goal hit 4 weeks in a row')
    expect(text()).toContain('Quiet so far')
    expect(text()).toContain('A new week started this morning.')
    expect(text()).not.toContain('Moments')
    expect(text()).not.toContain('This week together')
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
    expect(text()).toContain('Not joined 0 of 25 days')
  })

  it('only you: the ring is yours, Invite sits where moments would be', () => {
    show(GROUP_ALONE)
    expect(view.host.querySelectorAll('.g-mring-val')).toHaveLength(1)
    expect(text()).toContain('Just you so far')
    expect(text()).not.toContain('One tap cheers')
    click(button('Invite'))
    expect(mocks.invite).toHaveBeenCalledWith(GROUP_ALONE.id)
  })
})

describe('the group going away', () => {
  it('a 404 leaves for Groups with a toast, never a stale page', async () => {
    await act(async () => { show(null, 'gone') })
    expect(here.pathname).toBe('/me/groups')
    expect(lastToast()[0]).toBe("You're no longer in this group")
  })

  it('with no data and no answer it says so instead of staying blank', () => {
    show(null, 'error')
    expect(text()).toContain("Can't load this group")
  })
})
