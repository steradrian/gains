// @vitest-environment happy-dom
// The overlay as a person uses it: the pill opens it, before typing, results, the keyboard, Escape,
// the avatar's close, no results, offline, and reduced motion.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../sheets.jsx', async orig => ({ ...(await orig()), exerciseDetailSheet: vi.fn(), customExSheet: vi.fn(), weighInsSheet: vi.fn() }))

const { useStore } = await import('../../store/useStore.js')
const { setNav } = await import('../../lib/nav.js')
const { endSearch, useSearch } = await import('../../lib/search/session.js')
const { createFakeNutriTrace } = await import('../../lib/nutrition/fake-nutritrace.js')
const { useNutrition } = await import('../../lib/nutrition/store.js')
const { clearOnlineSearchCache } = await import('../../lib/nutrition/use-online-search.js')
const { customExSheet } = await import('../../sheets.jsx')
const RootHeader = (await import('../RootHeader.jsx')).default
const SearchOverlay = (await import('./SearchOverlay.jsx')).default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, navigate
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  navigate = vi.fn()
  setNav(navigate)
  history.replaceState({ idx: 0, key: 'k' }, '')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  useStore.setState({ user: null })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  act(() => endSearch())
  delete document.documentElement.dataset.motion
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const wait = ms => act(() => new Promise(r => setTimeout(r, ms)))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const pill = () => $('.spill-i')
async function mount(path = '/home') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><RootHeader title="Home" /><SearchOverlay /></MemoryRouter>))
}
async function type(value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(pill(), value)
    pill().dispatchEvent(new Event('input', { bubbles: true }))
  })
  await wait(320)
}
const key = (k, opts = {}) => act(() => { pill().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })) })

describe('the search overlay', () => {
  it('opens on the pill\'s focus, as a non-modal dialog the pill controls, with the tab\'s shortcuts', async () => {
    await mount()
    await act(async () => pill().focus())
    await wait(50)
    const dialog = $('#gains-search')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.hasAttribute('aria-modal')).toBe(false)
    expect(pill().getAttribute('aria-expanded')).toBe('true')
    expect(pill().getAttribute('aria-controls')).toBe('gains-search')
    expect($$('.chip-lg').map(c => c.textContent)).toEqual(['History', 'Exercises', 'Routines', 'Body'])
    expect($('.avatar-btn').getAttribute('aria-label')).toBe('Close search')
  })

  it('shows the best match and the groups, walks them with the arrows and opens one with Enter', async () => {
    await mount()
    await act(async () => pill().focus())
    await type('history')
    expect($('.sr-best').textContent).toContain('History')
    expect($('.sr-summary')).not.toBeNull()
    await key('ArrowDown')
    const first = $$('[data-search-row]')[0]
    expect(pill().getAttribute('aria-activedescendant')).toBe(first.id)
    expect(first.classList.contains('on')).toBe(true)
    await key('Enter')
    expect(navigate).toHaveBeenCalledWith('/train/history', { state: { searchVisit: useSearch.getState().id } })
    expect(useSearch.getState()).toMatchObject({ open: false, live: true })
  })

  it('Escape clears first, then closes; the avatar closes too', async () => {
    await mount()
    await act(async () => pill().focus())
    await type('squat')
    await key('Escape')
    expect(pill().value).toBe('')
    expect(useSearch.getState().open).toBe(true)
    await key('Escape')
    expect(useSearch.getState().live).toBe(false)
    await act(async () => pill().focus())
    expect(useSearch.getState().open).toBe(true)
    await act(async () => $('.avatar-btn').click())
    expect(useSearch.getState().live).toBe(false)
  })

  it('says when nothing matches, and offers to make it', async () => {
    await mount()
    await act(async () => pill().focus())
    await type('qqzzxxv')
    expect(document.body.textContent).toContain('Nothing matches “qqzzxxv”')
    const make = $$('[data-search-row]').find(r => r.textContent.includes('Create exercise'))
    await act(async () => make.click())
    expect(customExSheet).toHaveBeenCalledWith(null, null, 'qqzzxxv')
  })

  it('scopes to a group from the summary line, and Backspace in the empty pill drops the scope', async () => {
    await mount()
    await act(async () => pill().focus())
    await type('press')
    const exercises = $$('.sr-sum').find(b => b.textContent.includes('exercises'))
    await act(async () => exercises.click())
    expect(useSearch.getState().group).toBe('exercises')
    expect($('.sr-token')).not.toBeNull()
    expect(pill().placeholder).toBe('Search exercises')
    await type('')
    await key('Backspace')
    expect(useSearch.getState().group).toBe(null)
  })

  it('offline: your own results work, and Online says it comes back with the connection', async () => {
    const nt = createFakeNutriTrace()
    vi.stubGlobal('fetch', nt.fetch)
    clearOnlineSearchCache()
    useNutrition.getState().reset()
    useStore.setState({ user: { id: 7, name: 'A' } })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await mount()
    await act(async () => pill().focus())
    await type('nutella')
    await wait(50)
    expect(document.body.textContent).toContain('Online results come back when you reconnect')
  })

  it('with reduced motion still opens, scrolls and answers the keys', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await mount()
    await act(async () => pill().focus())
    await type('history')
    expect($('.sr-best')).not.toBeNull()
    await key('ArrowDown')
    expect(pill().getAttribute('aria-activedescendant')).toBeTruthy()
  })

  it('speaks the results once typing has stopped, in one polite region', async () => {
    await mount()
    await act(async () => pill().focus())
    await type('history')
    await wait(700)
    const live = $$('[role="status"]').find(el => el.getAttribute('aria-live') === 'polite' && el.closest('#gains-search'))
    expect(live.textContent).toMatch(/results?:/)
  })
})
