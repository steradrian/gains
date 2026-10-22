// @vitest-environment happy-dom
// The Challenge page (boards Fr3Join, Fr3Challenge, Fr3Done and the missed edge): not joined offers
// Count me in once, joined offers Start only when something is planned today, Leave is immediate
// with an Undo that joins again, done and missed copy comes from the data, Cheer everyone can be
// taken back, and nothing breaks when the server's invited list is empty.
import { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'

const mocks = vi.hoisted(() => ({
  toast: vi.fn(), newChallenge: vi.fn(), start: vi.fn(), S: {}, user: { id: 'u-adrian', name: 'Adrian' },
  getChallenge: vi.fn(), getGroup: vi.fn(), joinChallenge: vi.fn(), leaveChallenge: vi.fn(), sendCheer: vi.fn(), undoCheer: vi.fn(),
}))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/friends/api.js', async importActual => ({
  ...(await importActual()),
  friendsAvailable: () => true,
  getChallenge: (...a) => mocks.getChallenge(...a),
  getGroup: (...a) => mocks.getGroup(...a),
  joinChallenge: (...a) => mocks.joinChallenge(...a),
  leaveChallenge: (...a) => mocks.leaveChallenge(...a),
  sendCheer: (...a) => mocks.sendCheer(...a),
  undoCheer: (...a) => mocks.undoCheer(...a),
}))
vi.mock('../../sheets.jsx', () => ({ readyOrStart: (...a) => mocks.start(...a) }))
vi.mock('../../components/NewChallengeSheet.jsx', () => ({ newChallengeSheet: (...a) => mocks.newChallenge(...a) }))

import { todayISO } from '../../lib/format.js'
import { resetChallenges } from '../../lib/friends/use-challenge.js'
import { resetGroups } from '../../lib/friends/use-group.js'
import {
  CHALLENGE_ACTIVE, CHALLENGE_DONE, CHALLENGE_DONE_NO_STREAK, CHALLENGE_MISSED, CHALLENGE_NOT_JOINED, CHALLENGE_THREE,
  GROUP, PLANNED_TODAY_STATE, REST_TODAY_STATE,
} from '../../dev/screens/states/friends-fixture.js'
import { GROUP_FULL } from '../../dev/screens/states/friends-group-fixture.js'
import ChallengeScreen from './ChallengeScreen.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
let here = null
function Probe() { here = useLocation(); return null }

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const show = async (challenge, { S = REST_TODAY_STATE } = {}) => {
  mocks.S = S
  mocks.getChallenge.mockResolvedValue(structuredClone(challenge))
  mocks.getGroup.mockResolvedValue(structuredClone(GROUP_FULL))
  view.render(
    <MemoryRouter initialEntries={['/me/groups/' + GROUP.id + '/challenge/' + challenge.id]}>
      <Routes>
        <Route path="/me/groups/:id/challenge/:cid" element={<ChallengeScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  )
  await flush()
}
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button, a')].find(b => b.textContent === label)
const lastToast = () => mocks.toast.mock.calls.at(-1)

beforeEach(() => {
  for (const f of Object.values(mocks)) if (typeof f?.mockReset === 'function') f.mockReset()
  mocks.joinChallenge.mockResolvedValue({ ...CHALLENGE_ACTIVE })
  mocks.leaveChallenge.mockResolvedValue({ ...CHALLENGE_NOT_JOINED })
  mocks.sendCheer.mockResolvedValue({ ok: true })
  mocks.undoCheer.mockResolvedValue({ ok: true })
})
afterEach(() => { resetChallenges(); resetGroups() })

describe('not joined (Fr3Join)', () => {
  it('shows the title, dates and who started it, the count, the bar and what joining does', async () => {
    await show(CHALLENGE_NOT_JOINED)
    expect(view.host.querySelector('h1').textContent).toBe('Everyone trains 3× this week')
    expect(text()).toContain('started by Radu')
    expect(view.host.querySelector('.g-ccount b').textContent).toBe('9 of 12')
    expect(view.host.querySelector('.g-sbar').getAttribute('aria-label')).toBe('9 of 12 workouts')
    expect(text()).toContain("One shared bar. Each colour is someone's workouts, in the order you joined.")
    expect(text()).toContain('Joining adds your 3 to the goal. Leaving later takes them off, nothing else.')
    expect(button('Count me in')).toBeTruthy()
    expect(button('Leave challenge')).toBeUndefined()
    expect(button('Start Push A')).toBeUndefined()
  })

  it('lists who joined with their counts, then the person invited, dimmed', async () => {
    await show(CHALLENGE_NOT_JOINED)
    const rows = [...view.host.querySelectorAll('.g-mlist .g-mrow')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Mara', 'Radu', 'Ioana', 'Vlad', 'Adrian'])
    expect(rows.at(-1).className).toContain('g-mrow-dim')
    expect(rows.at(-1).textContent).toContain('Invited')
    expect(text()).toContain('4 of 5')
  })

  it('Count me in writes once, refetches, and the page becomes the joined one', async () => {
    await show(CHALLENGE_NOT_JOINED)
    mocks.getChallenge.mockResolvedValue(structuredClone(CHALLENGE_ACTIVE))
    click(button('Count me in'))
    await flush()
    expect(mocks.joinChallenge).toHaveBeenCalledTimes(1)
    expect(mocks.joinChallenge).toHaveBeenCalledWith(GROUP.id, CHALLENGE_NOT_JOINED.id)
    expect(mocks.getChallenge.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(button('Count me in')).toBeUndefined()
    expect(button('Leave challenge')).toBeTruthy()
  })

  it('a refused join toasts and stays not joined', async () => {
    await show(CHALLENGE_NOT_JOINED)
    mocks.joinChallenge.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    click(button('Count me in'))
    await flush()
    expect(lastToast()[0]).toBe("Couldn't do that. Try again when you're online.")
    expect(button('Count me in')).toBeTruthy()
  })
})

describe('joined (Fr3Challenge)', () => {
  it('shows the count, how long is left, the bar with its spoken total, and Who\'s in with the viewer marked', async () => {
    await show({ ...CHALLENGE_ACTIVE, end: todayISO() })
    expect(view.host.querySelector('.g-ccount b').textContent).toBe('12 of 15')
    expect(view.host.querySelector('.g-ccount span').textContent).toBe('workouts · ends tonight')
    expect(view.host.querySelector('.g-sbar').getAttribute('aria-label')).toBe('12 of 15 workouts')
    expect(view.host.querySelectorAll('.g-sbar-seg')).toHaveLength(5)
    const rows = [...view.host.querySelectorAll('.g-mlist .g-mrow')]
    expect(rows[0].textContent).toContain('You')
    expect(text()).toContain('5 of 5')
  })

  it('offers Start with what is planned today, and the next one that will count', async () => {
    await show(CHALLENGE_ACTIVE, { S: PLANNED_TODAY_STATE })
    expect(text()).toContain("Workout 3 of 3 counts the moment you finish today's workout.")
    click(button('Start Push A'))
    expect(mocks.start).toHaveBeenCalledWith(['r-push'])
  })

  it('has no Start and no caption when nothing is planned today', async () => {
    await show(CHALLENGE_ACTIVE, { S: REST_TODAY_STATE })
    expect(text()).not.toContain('Start ')
    expect(text()).not.toContain('counts the moment you finish')
  })

  it('has no "counts the moment" line when the person has reached their share', async () => {
    const reached = { ...CHALLENGE_ACTIVE, joined: CHALLENGE_ACTIVE.joined.map(j => ({ ...j, count: 3 })) }
    await show(reached, { S: PLANNED_TODAY_STATE })
    expect(button('Start Push A')).toBeTruthy()
    expect(text()).not.toContain('counts the moment you finish')
  })

  it('says what counts for a template that is not workouts, with no Start', async () => {
    await show(CHALLENGE_THREE, { S: PLANNED_TODAY_STATE })
    expect(text()).toContain('Counts days each of you reached it')
    expect(text()).not.toContain('Start ')
    expect(view.host.querySelectorAll('.g-sbar-seg')).toHaveLength(3)
  })

  it('draws the bar and the people when the server\'s invited list is empty', async () => {
    await show({ ...CHALLENGE_ACTIVE, invited: undefined })
    expect(view.host.querySelectorAll('.g-mlist .g-mrow')).toHaveLength(5)
  })
})

describe('Leave challenge', () => {
  it('leaves at once, with no confirm, and offers Undo in the toast', async () => {
    await show(CHALLENGE_ACTIVE)
    mocks.getChallenge.mockResolvedValue(structuredClone(CHALLENGE_NOT_JOINED))
    click(button('Leave challenge'))
    await flush()
    expect(mocks.leaveChallenge).toHaveBeenCalledTimes(1)
    expect(lastToast()[0]).toBe('Left the challenge')
    expect(lastToast()[1].action).toBe('Undo')
    expect(button('Count me in')).toBeTruthy()
  })

  it('Undo joins again', async () => {
    await show(CHALLENGE_ACTIVE)
    mocks.getChallenge.mockResolvedValue(structuredClone(CHALLENGE_NOT_JOINED))
    click(button('Leave challenge'))
    await flush()
    mocks.getChallenge.mockResolvedValue(structuredClone(CHALLENGE_ACTIVE))
    await act(async () => { lastToast()[1].onAction() })
    await flush()
    expect(mocks.joinChallenge).toHaveBeenCalledTimes(1)
    expect(button('Leave challenge')).toBeTruthy()
  })

  it('a refused leave toasts the problem and keeps the person in', async () => {
    await show(CHALLENGE_ACTIVE)
    mocks.leaveChallenge.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    click(button('Leave challenge'))
    await flush()
    expect(lastToast()[0]).toBe("Couldn't do that. Try again when you're online.")
    expect(button('Leave challenge')).toBeTruthy()
  })
})

describe('done (Fr3Done)', () => {
  it('says it with the data: the totals, the weeks in a row and who was in', async () => {
    await show(CHALLENGE_DONE)
    expect(text()).toContain('You did it, together')
    expect(text()).toContain('15 of 15 workouts. Everyone trained 3 times this week.')
    expect(text()).toContain('Goal hit 5 weeks in a row · 5 of 5 in')
    expect(view.host.querySelector('.g-sempty svg')).not.toBeNull()
    expect(button('Count me in')).toBeUndefined()
    expect(button('Leave challenge')).toBeUndefined()
  })

  it('leaves the streak line out at 0', async () => {
    await show(CHALLENGE_DONE_NO_STREAK)
    expect(text()).toContain('15 of 15 workouts.')
    expect(text()).not.toContain('Goal hit')
  })

  it('Cheer everyone cheers the challenge, and the toast\'s Undo takes it back', async () => {
    await show(CHALLENGE_DONE)
    click(button('Cheer everyone'))
    await flush()
    expect(mocks.sendCheer).toHaveBeenCalledWith({ group: GROUP.id, kind: 'challenge', ref: CHALLENGE_DONE.id })
    expect(lastToast()[0]).toBe('Cheered everyone')
    expect(button('Cheered')).toBeTruthy()
    await act(async () => { lastToast()[1].onAction() })
    await flush()
    expect(mocks.undoCheer).toHaveBeenCalledWith({ group: GROUP.id, kind: 'challenge', ref: CHALLENGE_DONE.id })
    expect(button('Cheer everyone')).toBeTruthy()
  })

  it('a refused cheer puts the button back and says so', async () => {
    await show(CHALLENGE_DONE)
    mocks.sendCheer.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    click(button('Cheer everyone'))
    await flush()
    expect(button('Cheer everyone')).toBeTruthy()
    expect(lastToast()[0]).toBe("Couldn't do that. Try again when you're online.")
  })

  it('Pick next week\'s challenge opens New challenge for this group', async () => {
    await show(CHALLENGE_DONE)
    click(button("Pick next week's challenge"))
    expect(mocks.newChallenge).toHaveBeenCalledWith(GROUP.id)
  })
})

describe('missed', () => {
  it('says how far the group got and that it ended, names no one, and offers the next challenge', async () => {
    await show(CHALLENGE_MISSED)
    expect(view.host.querySelector('.g-ccount b').textContent).toBe('11 of 15')
    expect(view.host.querySelector('.g-ccount span').textContent).toBe('workouts · Ended')
    expect(text()).not.toContain('You did it')
    expect(text()).not.toMatch(/missed|fell short|behind/i)
    expect(button('Count me in')).toBeUndefined()
    expect(button('Leave challenge')).toBeUndefined()
    click(button("Pick next week's challenge"))
    expect(mocks.newChallenge).toHaveBeenCalledWith(GROUP.id)
  })
})

describe('the way out', () => {
  it('goes up to the group when the challenge is gone', async () => {
    mocks.S = REST_TODAY_STATE
    mocks.getChallenge.mockRejectedValue(Object.assign(new Error('x'), { code: 'not-found' }))
    mocks.getGroup.mockResolvedValue(structuredClone(GROUP_FULL))
    view.render(
      <MemoryRouter initialEntries={['/me/groups/' + GROUP.id + '/challenge/c-gone']}>
        <Routes>
          <Route path="/me/groups/:id/challenge/:cid" element={<ChallengeScreen />} />
          <Route path="*" element={null} />
        </Routes>
        <Probe />
      </MemoryRouter>,
    )
    await flush()
    expect(here.pathname).toBe('/me/groups/' + GROUP.id)
  })

  it('says the challenge could not load instead of staying blank', async () => {
    mocks.S = REST_TODAY_STATE
    mocks.getChallenge.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    mocks.getGroup.mockResolvedValue(structuredClone(GROUP_FULL))
    view.render(
      <MemoryRouter initialEntries={['/me/groups/' + GROUP.id + '/challenge/c-x']}>
        <Routes><Route path="/me/groups/:id/challenge/:cid" element={<ChallengeScreen />} /></Routes>
      </MemoryRouter>,
    )
    await flush()
    expect(text()).toContain("Can't load this challenge")
  })
})
