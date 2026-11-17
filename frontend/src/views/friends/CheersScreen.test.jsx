// @vitest-environment happy-dom
// Cheers for you (board Fr8Cheers): newest first, "From <group>" only with one group, the week and
// its count, a week everyone cheered as one row with its streak, the empty scene, the footer, and
// opening the page tells the server it looked.
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../ds/render.test-util.js'

const mocks = vi.hoisted(() => ({ getCheers: vi.fn(), user: { id: 'u-adrian', name: 'Adrian' } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: {}, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/friends/api.js', async importActual => ({ ...(await importActual()), getCheers: (...a) => mocks.getCheers(...a) }))

import { __setMockFriends } from '../../lib/friends/store.js'
import { __setMockCheers } from '../../lib/friends/use-cheers.js'
import { GROUP, GROUP_QUIET, ME_ON } from '../../dev/screens/states/friends-fixture.js'
import { CHEERS_PLAIN, CHEERS_TWO_GROUPS, CHEERS_WITH_WEEK } from '../../dev/screens/states/friends-surfaces-fixture.js'
import CheersScreen from './CheersScreen.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const view = useView()
const undos = []
const show = (cheers, groups = [GROUP], opts) => {
  undos.push(__setMockFriends({ me: ME_ON, groups }))
  undos.push(__setMockCheers(cheers, opts))
  view.render(<MemoryRouter initialEntries={['/me/groups/cheers']}><CheersScreen /></MemoryRouter>)
}
const text = () => view.host.textContent
const rowTexts = () => [...view.host.querySelectorAll('.g-crow-body b')].map(b => b.textContent)

beforeEach(() => { mocks.getCheers.mockReset().mockResolvedValue([]) })
afterEach(() => { while (undos.length) undos.pop()() })

describe('Cheers for you', () => {
  it('the title, "From Iron Sunday", This week with its count, and the rows newest first', () => {
    show(CHEERS_WITH_WEEK)
    expect(view.host.querySelector('h1').textContent).toBe('Cheers for you')
    expect(text()).toContain('From Iron Sunday')
    expect(text()).toContain('This week')
    expect(view.host.querySelector('.g-ssec-act').textContent).toBe('3')
    expect(rowTexts()).toEqual(['Mara cheered your Push A', 'Radu cheered your new best Cable fly', 'Everyone cheered the week'])
    expect(text()).toContain('20 kg x 12')
    expect(text()).toContain('Goal hit · 4 weeks in a row')
  })

  it('without a week everyone cheered, the week is one row per person and has no streak line', () => {
    show(CHEERS_PLAIN)
    expect(rowTexts()).toEqual(['Mara cheered your Push A', 'Radu cheered your new best Cable fly', 'Mara cheered your week'])
    expect(text()).not.toContain('Goal hit')
  })

  it('with several groups there is no "From" line and each row names its group', () => {
    show(CHEERS_TWO_GROUPS, [GROUP, GROUP_QUIET])
    expect(text()).not.toContain('From ')
    expect(text()).toContain('Iron Sunday · Sunday evening')
    expect(text()).toContain('Sunday crew')
  })

  it('says there are none yet, with the scene, and no count', () => {
    show([])
    expect(text()).toContain('No cheers yet this week')
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
    expect(view.host.querySelector('.g-crow')).toBeNull()
    expect(view.host.querySelector('.g-ssec-act')).toBeNull()
  })

  it('ends with the line about notifications', () => {
    show(CHEERS_PLAIN)
    expect(text()).toContain('Cheers also arrive as a notification, once an evening at most.')
  })

  it('says when the server is out of reach and still shows the last update', () => {
    show(CHEERS_PLAIN, [GROUP], { stale: true })
    expect(text()).toContain("Can't reach the server, showing the last update")
    expect(rowTexts()).toHaveLength(3)
  })

  it('shows nothing before the first answer', () => {
    undos.push(__setMockFriends({ me: ME_ON, groups: [GROUP] }))
    view.render(<MemoryRouter initialEntries={['/me/groups/cheers']}><CheersScreen /></MemoryRouter>)
    expect(view.host.querySelector('.g-crow')).toBeNull()
    expect(text()).not.toContain('No cheers yet')
  })
})
