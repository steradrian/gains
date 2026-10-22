// @vitest-environment happy-dom
// What you share (board Fr5Sharing): every switch writes through at once once Friends is on; while
// it is off the switches change nothing but the screen, and only the Turn on Friends button turns it on.
import { act } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../ds/render.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toast: vi.fn(), putMe: vi.fn(), S: null, user: { id: 'u-adrian', name: 'Adrian' } }))
vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user })
  const useStore = selector => selector(snap())
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(), remoteServer: () => '' }))
vi.mock('../../lib/friends/api.js', async importActual => ({ ...(await importActual()), putMe: (...a) => mocks.putMe(...a) }))

import { __setMockFriends } from '../../lib/friends/store.js'
import { GROUP, ME_OFF, ME_ON, PREVIEW_STATE, SHARE } from '../../dev/screens/states/friends-fixture.js'
import SharingScreen from './SharingScreen.jsx'

const view = useView()
let undo = null
let here = null
function Probe() { here = useLocation(); return null }

const show = (me, groups, entry = '/me/groups/sharing') => {
  undo = __setMockFriends({ me, groups })
  view.render(<MemoryRouter initialEntries={[entry]}><SharingScreen /><Probe /></MemoryRouter>)
}
const text = () => view.host.textContent
const sw = name => view.host.querySelector(`[role="switch"][aria-label="${name}"]`)
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

beforeEach(() => {
  mocks.S = PREVIEW_STATE
  mocks.toast.mockReset()
  mocks.putMe.mockReset()
})
afterEach(() => { undo?.(); undo = null })

describe('with Friends on', () => {
  it('draws the four switches from the stored share, the never-shared rows and the preview', () => {
    show(ME_ON, [GROUP])
    expect(sw('Training done').getAttribute('aria-checked')).toBe('true')
    expect(sw('New bests').getAttribute('aria-checked')).toBe('false')
    expect(text()).toContain('Off: you can still share one from a workout summary')
    for (const part of ['Never shared', 'Weight and body', 'What you eat', 'Preview', 'as Mara sees you', 'Never shared: weight, foods, what you ate, photos']) expect(text()).toContain(part)
    expect(text()).not.toContain('Turn on Friends')
  })

  it('each switch writes the whole share through PUT /me and the preview follows', async () => {
    mocks.putMe.mockImplementation(async ({ share }) => ({ ...ME_ON, share }))
    show(ME_ON, [GROUP])
    click(sw('Weekly consistency'))
    await flush()
    expect(mocks.putMe).toHaveBeenCalledWith({ share: { ...SHARE, consistency: false } })
    click(sw('New bests'))
    await flush()
    expect(mocks.putMe).toHaveBeenLastCalledWith({ share: { ...SHARE, bests: true } })
  })

  it('a refused write toasts and puts the old value back', async () => {
    mocks.putMe.mockRejectedValue(new Error('offline'))
    show(ME_ON, [GROUP])
    click(sw('Training done'))
    await flush()
    expect(mocks.toast).toHaveBeenCalledWith("Couldn't do that. Try again when you're online.")
    expect(sw('Training done').getAttribute('aria-checked')).toBe('true')
  })

  it('names "a friend" when nobody else is in a group yet', () => {
    show(ME_ON, [])
    expect(text()).toContain('as a friend sees you')
  })
})

describe('turning Friends on (first time)', () => {
  it('switches only change the screen: nothing is sent until Turn on Friends', async () => {
    show(ME_OFF, [], '/me/groups/sharing?first=1')
    expect(text()).toContain('Nothing goes out until you join')
    click(sw('Training done'))
    await flush()
    expect(mocks.putMe).not.toHaveBeenCalled()
    expect(sw('Training done').getAttribute('aria-checked')).toBe('false')
  })

  it('the button turns Friends on with the chosen switches and goes to Groups', async () => {
    mocks.putMe.mockResolvedValue({ ...ME_ON, share: { ...SHARE, targets: false } })
    show(ME_OFF, [], '/me/groups/sharing?first=1')
    click(sw('Food targets reached'))
    const button = [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Turn on Friends')
    await act(async () => { button.click() })
    await flush()
    expect(mocks.putMe).toHaveBeenCalledWith({ on: true, share: { ...SHARE, targets: false } })
    expect(here.pathname).toBe('/me/groups')
  })

  it('a refusal toasts and stays put', async () => {
    mocks.putMe.mockRejectedValue(new Error('offline'))
    show(ME_OFF, [], '/me/groups/sharing?first=1')
    const button = [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Turn on Friends')
    await act(async () => { button.click() })
    await flush()
    expect(mocks.toast).toHaveBeenCalled()
    expect(here.pathname).toBe('/me/groups/sharing')
  })

  it('coming from an invite, it goes back to that invite', async () => {
    mocks.putMe.mockResolvedValue({ ...ME_ON })
    undo = __setMockFriends({ me: ME_OFF, groups: [] })
    view.render(<MemoryRouter initialEntries={[{ pathname: '/me/groups/sharing', state: { returnTo: '/me/groups/join/k7Qp9x2Lm' } }]}><SharingScreen /><Probe /></MemoryRouter>)
    const button = [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Turn on Friends')
    await act(async () => { button.click() })
    await flush()
    expect(here.pathname).toBe('/me/groups/join/k7Qp9x2Lm')
  })
})
