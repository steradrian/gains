// @vitest-environment happy-dom
// The Member page (boards Fr2Member, Fr2Gap): sections appear only when the payload has them, a
// week off is empty and never red, nothing about weight or foods is ever drawn, the footer is built
// from the person's switches, your own page has no Cheer and no menu, Cheer is optimistic with
// Undo, and a person who is gone sends the page back to the group.
import { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toast: vi.fn(), menu: vi.fn(), getMember: vi.fn(), getGroup: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: {}, user: { id: 'u-adrian', name: 'Adrian' } })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../components/MemberMenuSheet.jsx', () => ({ memberMenuSheet: (...a) => mocks.menu(...a) }))
vi.mock('../../lib/friends/api.js', async importActual => ({
  ...(await importActual()),
  getMember: (...a) => mocks.getMember(...a),
  getGroup: (...a) => mocks.getGroup(...a),
}))

import {
  GROUP_FULL, MEMBER_IOANA_NOTHING, MEMBER_MARA, MEMBER_MARA_CHEERED, MEMBER_RADU_SOME_OFF, MEMBER_SELF, MEMBER_VLAD_GAP,
} from '../../dev/screens/states/friends-member-fixture.js'
import { FriendsError } from '../../lib/friends/api.js'
import { __setMockMember, refreshMember, resetMembers } from '../../lib/friends/use-member.js'
import MemberScreen from './MemberScreen.jsx'

const view = useView()
let undo = null
let here = null
function Probe() { here = useLocation(); return null }

const open = uid => (
  <MemoryRouter key={uid} initialEntries={['/me/groups/g-iron-sunday/member/' + uid]}>
    <Routes>
      <Route path="/me/groups/:id/member/:uid" element={<MemberScreen />} />
      <Route path="*" element={null} />
    </Routes>
    <Probe />
  </MemoryRouter>
)
const show = (member, group = GROUP_FULL) => {
  undo = __setMockMember({ groupId: group.id, uid: member.uid, member, group })
  view.render(open(member.uid))
}
const text = () => view.host.textContent
const titles = () => [...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
const button = label => [...view.host.querySelectorAll('button, a')].find(b => b.textContent === label)
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  resetMembers()
  for (const m of Object.values(mocks)) m.mockReset()
})
afterEach(() => { undo?.(); undo = null; resetMembers() })

describe('a member who shares everything (Fr2Member)', () => {
  it('draws the header, every section and the footer', () => {
    show(MEMBER_MARA)
    expect(view.host.querySelector('h1').textContent).toBe('Mara')
    expect(text()).toContain('In Iron Sunday since')
    expect(view.host.querySelector('.g-mavatar-lg').textContent).toBe('M')
    expect(titles()).toEqual(['This week', 'Recent workouts', 'Consistency', 'Food targets', 'New bests'])
    expect(text()).toContain('3 of 4')
    for (const part of ['Legs', 'Pull A', 'Push A', '54 min', '48 min', '51 min']) expect(text()).toContain(part)
    expect(text()).toContain('last 8 weeks')
    expect(text()).toContain('Share of planned workouts done each week. A week off shows empty, never red.')
    expect(text()).toContain('reached 5 of 7')
    expect(text()).toContain("Only whether a day's target was reached. Never foods, amounts or weight.")
    expect(text()).toContain('shared by Mara')
    expect(text()).toContain('Romanian deadlift')
    expect(text()).toContain("Mara doesn't share: ")
    expect(text()).toContain("You can't ask to see them.")
  })

  it('draws the week as seven day dots with this week\'s done days checked', () => {
    show(MEMBER_MARA)
    const week = view.host.querySelectorAll('.g-swc')[0]
    expect(week.querySelectorAll('.g-swc-cell')).toHaveLength(7)
    expect(week.querySelectorAll('.g-swc-done')).toHaveLength(3)
    expect(week.querySelector('.g-swc-missed')).toBeNull()
  })

  it('shows a week off in the Consistency bars as an empty bar, never a red one', () => {
    show(MEMBER_MARA)
    const bars = [...view.host.querySelectorAll('.g-bar')]
    expect(bars).toHaveLength(8)
    expect(bars[3].querySelector('i').style.height).toBe('3px')
    expect(bars[0].querySelector('i').style.height).not.toBe('3px')
    expect(view.host.querySelector('.g-bars-card').getAttribute('style')).toBeNull()
    expect(view.host.querySelectorAll('.g-bars-card .g-sr li')[3].textContent).toMatch(/week off$/)
    expect(bars.map(b => b.querySelector('small').textContent).every(l => /^W\d+$/.test(l))).toBe(true)
  })
})

describe('privacy', () => {
  it('never draws a weight, a food or an amount, whatever the person shares', () => {
    for (const member of [MEMBER_MARA, MEMBER_VLAD_GAP, MEMBER_RADU_SOME_OFF, MEMBER_IOANA_NOTHING, MEMBER_SELF]) {
      show(member)
      expect(text()).not.toMatch(/\b\d+([.,]\d+)?\s?(kg|lb|lbs|kcal|g)\b/i)
      undo(); undo = null
    }
  })

  it('draws only what the payload carries: Radu shares training, so there is no Consistency, Food targets or New bests', () => {
    show(MEMBER_RADU_SOME_OFF)
    expect(titles()).toEqual(['This week', 'Recent workouts'])
    expect(text()).toContain('Push B')
    expect(text()).toContain("Radu doesn't share: ")
    expect(text()).toMatch(/consistency.*food targets.*new bests.*weight.*foods.*photos/)
  })

  it('keeps the same two rows of workouts apart when two sessions share a name', () => {
    show(MEMBER_RADU_SOME_OFF)
    expect(view.host.querySelectorAll('.g-glist-row')).toHaveLength(2)
  })

  it('a person with every switch off gets one line saying so, and the footer, and no section', () => {
    show(MEMBER_IOANA_NOTHING)
    expect(text()).toContain("Ioana hasn't shared anything yet")
    expect(titles()).toEqual([])
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
    expect(text()).toContain("Ioana doesn't share: ")
    expect(text()).toMatch(/training.*consistency.*food targets.*new bests.*weight.*foods.*photos/)
  })
})

describe('a week off (Fr2Gap)', () => {
  it('says there is no plan, that it does not count against the group, and keeps Consistency and Food targets', () => {
    show(MEMBER_VLAD_GAP)
    expect(text()).toContain('No plan this week')
    expect(text()).toContain("Vlad took the week off. It doesn't count against the group goal.")
    expect(titles()).toEqual(['Consistency', 'Food targets'])
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
  })

  it('draws nothing red or missed for it', () => {
    show(MEMBER_VLAD_GAP)
    expect(view.host.querySelector('.g-swc-missed')).toBeNull()
    expect(text()).not.toMatch(/missed|failed|behind/i)
  })
})

describe('your own page', () => {
  it('has no Cheer pill and no menu, only Back', () => {
    show(MEMBER_SELF)
    expect(button('Cheer')).toBeUndefined()
    expect(button('Cheered')).toBeUndefined()
    expect(view.host.querySelector('[aria-label="Member options"]')).toBeNull()
    expect(view.host.querySelector('[aria-label="Back"]')).not.toBeNull()
    expect(text()).toContain('Adrian')
  })
})

describe('Cheer', () => {
  it('cheers the week at once: the pill turns to Cheered and the toast offers Undo', () => {
    show(MEMBER_MARA)
    click(button('Cheer'))
    expect(button('Cheered')).toBeDefined()
    expect(button('Cheer')).toBeUndefined()
    expect(mocks.toast).toHaveBeenCalledWith("Cheered Mara's week", expect.objectContaining({ action: 'Undo' }))
  })

  it('Undo turns the pill back', async () => {
    show(MEMBER_MARA)
    click(button('Cheer'))
    await act(async () => { mocks.toast.mock.calls[0][1].onAction(); await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(button('Cheer')).toBeDefined()
  })

  it('a week already cheered shows Cheered and does nothing when tapped', () => {
    show(MEMBER_MARA_CHEERED)
    click(button('Cheered'))
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})

describe('the menu button', () => {
  it('opens the Member menu with this person and the group', () => {
    show(MEMBER_MARA)
    click(view.host.querySelector('[aria-label="Member options"]'))
    expect(mocks.menu).toHaveBeenCalledWith({ group: GROUP_FULL, member: MEMBER_MARA })
  })
})

describe('a person who is gone', () => {
  const missing = () => new FriendsError('gone', { status: 404, code: 'not-found' })

  it('goes back to the group with a toast when the server no longer has them there', async () => {
    mocks.getMember.mockRejectedValue(missing())
    mocks.getGroup.mockResolvedValue(GROUP_FULL)
    view.render(open('u-mara'))
    await flush()
    expect(mocks.toast).toHaveBeenCalledWith('This person is no longer in this group')
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
  })

  it('goes to Groups when the group itself is gone', async () => {
    mocks.getMember.mockRejectedValue(missing())
    mocks.getGroup.mockRejectedValue(missing())
    view.render(open('u-mara'))
    await flush()
    expect(mocks.toast).toHaveBeenCalledWith('This group is no longer available')
    expect(here.pathname).toBe('/me/groups')
  })

  it('names them when the page had loaded them first', async () => {
    mocks.getMember.mockResolvedValueOnce(MEMBER_MARA)
    mocks.getGroup.mockResolvedValue(GROUP_FULL)
    view.render(open('u-mara'))
    await flush()
    expect(text()).toContain('Mara')
    mocks.getMember.mockRejectedValue(missing())
    await act(async () => { await refreshMember('g-iron-sunday', 'u-mara') })
    expect(mocks.toast).toHaveBeenCalledWith('Mara is no longer in this group')
    expect(here.pathname).toBe('/me/groups/g-iron-sunday')
  })
})

describe('the server cannot be reached', () => {
  it('with nothing loaded says so and offers Try again', async () => {
    mocks.getMember.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    mocks.getGroup.mockRejectedValue(new FriendsError('offline', { code: 'offline' }))
    view.render(open('u-mara'))
    await flush()
    expect(text()).toContain("Can't reach the server")
    expect(button('Try again')).toBeDefined()
  })
})
