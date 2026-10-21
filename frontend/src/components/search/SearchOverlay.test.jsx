// @vitest-environment happy-dom
// The overlay as a person uses it (owner direction for PR-07, the bearmenu search: the header stays,
// its pill is the one input, the panel under it holds the results): the field opens it, before
// typing, results, the keyboard, Escape, the bell's ×, nothing matches, one kind, Open Food Facts
// slow, failing and offline, and reduced motion.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../sheets.jsx', async orig => ({ ...(await orig()), exerciseDetailSheet: vi.fn(), customExSheet: vi.fn(), weighInsSheet: vi.fn() }))

const { DEF, useStore } = await import('../../store/useStore.js')
const { useUI } = await import('../../store/useUI.js')
const { setNav } = await import('../../lib/nav.js')
const { CATALOGUE } = await import('../../lib/exercises.js')
const { endSearch, syncSearchWithHistory, useSearch } = await import('../../lib/search/session.js')
const { addRecent, clearRecents, noteOpened, useRecents } = await import('../../lib/search/recents.js')
const { createFakeNutriTrace } = await import('../../lib/nutrition/fake-nutritrace.js')
const { useNutrition } = await import('../../lib/nutrition/store.js')
const { resetOnlineSearch } = await import('../../lib/nutrition/use-online-search.js')
const { customExSheet } = await import('../../sheets.jsx')
const RootHeader = (await import('../RootHeader.jsx')).default
const SearchOverlay = (await import('./SearchOverlay.jsx')).default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, navigate, originalS
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  navigate = vi.fn()
  setNav(navigate)
  history.replaceState({ idx: 0, key: 'k' }, '')
  vi.spyOn(history, 'back').mockImplementation(() => {})
  originalS = useStore.getState().S
  useStore.setState({ user: null })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  act(() => endSearch())
  clearRecents()
  useRecents.setState({ opened: {}, searched: false })
  useStore.setState({ S: originalS })
  useUI.setState({ toastMsg: '', toastAction: null })
  delete document.documentElement.dataset.motion
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const wait = ms => act(() => new Promise(r => setTimeout(r, ms)))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const pill = () => $('.g-shdr-pin .g-spill-field input')
const closeX = () => $('.g-shdr-pin .g-bell')
const list = () => $('#gains-search-list')
const options = () => [...list().querySelectorAll('[role="option"]')]
async function mount(path = '/home', action) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><RootHeader title="Home" action={action} /><SearchOverlay /></MemoryRouter>))
}
async function open() {
  await act(async () => pill().focus())
  await wait(50)
}
async function type(value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(pill(), value)
    pill().dispatchEvent(new Event('input', { bubbles: true }))
  })
  await wait(320)
}
const key = (k, opts = {}) => act(() => { pill().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })) })
const signedIn = () => {
  const nt = createFakeNutriTrace()
  nt.state.settings.offSearchCountry = 'World'   // the device region would default the search to a country
  vi.stubGlobal('fetch', nt.fetch)
  resetOnlineSearch()
  useNutrition.getState().reset()
  useNutrition.setState(s => ({ settings: { ...s.settings, data: { ...s.settings.data, offSearchCountry: 'World' } } }))
  useStore.setState({ user: { id: 7, name: 'A' } })
  return nt
}

describe('the search overlay', () => {
  it('opens on the field\'s focus under the header, which stays: the field a combobox controlling the results listbox', async () => {
    await mount()
    expect(pill().getAttribute('aria-haspopup')).toBe('listbox')
    expect(pill().getAttribute('aria-expanded')).toBe('false')
    expect($('#gains-search')).toBeNull()
    await open()
    expect(pill().getAttribute('role')).toBe('combobox')
    expect(pill().getAttribute('aria-expanded')).toBe('true')
    expect(pill().getAttribute('aria-controls')).toBe('gains-search-list')
    // The panel is on the stage, a results panel only: no input, no scrim, no header of its own.
    const panel = $('#gains-search')
    expect(panel.classList.contains('search-ov')).toBe(true)
    expect(panel.classList.contains('g-root')).toBe(true)
    expect(panel.querySelector('input')).toBeNull()
    expect(panel.querySelector('header')).toBeNull()
    // It only fades: its top edge never moves off the header's (the rise is its scroller's), and
    // its ground is the stage's art, as the header's is.
    expect(panel.style.transform).toBe('')
    expect(panel.querySelector('.search-ov-bg > .g-stage-art')).not.toBeNull()
    expect(list().getAttribute('role')).toBe('listbox')
    expect(list().closest('#gains-search')).not.toBeNull()
    expect(closeX().getAttribute('aria-label')).toBe('Close search')
    expect($('.g-shdr-pin .g-sbtn:not(.g-bell)').getAttribute('aria-label')).toBe('Settings')
  })

  it('first use: "Search everything", Suggested, then the tab\'s Go to chips, plain buttons outside the listbox', async () => {
    await mount()
    await open()
    expect($('#gains-search .g-sempty b').textContent).toBe('Search everything')
    expect($('#gains-search .g-sempty').textContent).toContain('Find any page, setting, exercise, workout, food or day.')
    const chips = $$('#gains-search .g-goto-chip')
    expect(chips.map(c => c.textContent)).toEqual(['History', 'Exercises', 'Routines', 'Body'])
    for (const c of chips) {
      expect(c.hasAttribute('role')).toBe(false)
      expect(c.tabIndex).toBe(0)
      expect(list().contains(c)).toBe(false)
      // First use: the chips come after the listbox.
      expect(list().compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('the keyboard order is the header, then the chips and Clear; the rows and their × are the arrows\'', async () => {
    addRecent({ kind: 'query', query: 'squat' })
    await mount()
    await open()
    expect($('#gains-search .g-sempty')).toBeNull()
    const tabbable = [...document.querySelectorAll('button, input, a[href], [tabindex]')].filter(el => el.tabIndex >= 0 && !el.closest('[inert]'))
    const order = tabbable.map(el => (el === pill() ? 'pill' : el.classList.contains('g-bell') ? 'close' : el.classList.contains('g-sbtn') ? 'avatar'
      : el.classList.contains('g-goto-chip') ? 'chip' : el.classList.contains('g-ssect-act') ? 'clear' : 'other:' + el.className))
    expect(order).toEqual(['avatar', 'pill', 'close', 'chip', 'chip', 'chip', 'chip', 'clear'])
    // Clear does what it says, with Undo for 8 s, and the focus goes back to the field.
    await act(async () => $('.g-ssect-act').click())
    expect(useRecents.getState().list).toEqual([])
    expect(document.activeElement).toBe(pill())
    expect(useUI.getState().toastMsg).toBe('Recent searches cleared')
    expect(useUI.getState().toastAction).toMatchObject({ label: 'Undo', ms: 8000 })
    await act(async () => useUI.getState().runToastAction())
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['squat'])
  })

  it('shows the counts, the best match and the groups, walks them with the arrows and opens one with Enter', async () => {
    await mount()
    await open()
    await type('history')
    expect($('.g-best').textContent).toContain('History')
    expect($('.g-best').textContent).toContain('Best match · Page')
    expect($('.g-rchips')).not.toBeNull()
    expect(list().contains($('.g-rchips'))).toBe(false)
    await key('ArrowDown')
    const first = options()[0]
    expect(first).toBe($('.g-best'))
    expect(pill().getAttribute('aria-activedescendant')).toBe(first.id)
    expect(first.getAttribute('aria-selected')).toBe('true')
    await key('Enter')
    expect(navigate).toHaveBeenCalledWith('/train/history', { state: { searchVisit: useSearch.getState().id } })
    expect(useSearch.getState()).toMatchObject({ open: false, live: true })
  })

  it('Escape clears first, then closes; the bell\'s × closes too; either way the focus lands on the bell', async () => {
    await mount()
    await open()
    await type('squat')
    await key('Escape')
    expect(pill().value).toBe('')
    expect(useSearch.getState().open).toBe(true)
    await key('Escape')
    expect(useSearch.getState().live).toBe(false)
    expect(document.activeElement).toBe(closeX())
    expect(closeX().getAttribute('aria-label')).toBe('Notifications')
    await open()
    expect(useSearch.getState().open).toBe(true)
    await act(async () => closeX().click())
    expect(useSearch.getState().live).toBe(false)
    expect(document.activeElement).toBe(closeX())
    expect(closeX().getAttribute('aria-label')).toBe('Notifications')
  })

  it('says when nothing matches, and offers to make it', async () => {
    await mount()
    await open()
    await type('qqzzxxv')
    expect($('#gains-search .g-sempty b').textContent).toBe('Nothing matches “qqzzxxv”')
    expect($('#gains-search .g-sempty').textContent).toContain('Try another word, or make it yourself.')
    const make = options().find(r => r.textContent.includes('Create exercise'))
    await act(async () => make.click())
    expect(customExSheet).toHaveBeenCalledWith(null, null, 'qqzzxxv')
  })

  it('no such exercise from Train: Create the name first, which opens New exercise with it', async () => {
    await mount('/train')
    await open()
    await type('qqzzxxv')
    expect($('#gains-search .g-sempty b').textContent).toBe('No exercise called “qqzzxxv”')
    expect($('#gains-search .g-sempty').textContent).toContain('It isn’t in the library or your own exercises yet.')
    const first = options()[0]
    expect(first.textContent).toContain('Create “qqzzxxv”')
    expect(first.textContent).toContain('Opens New exercise with the name filled in')
    await act(async () => first.click())
    expect(customExSheet).toHaveBeenCalledWith(null, null, 'qqzzxxv')
  })

  it('scopes to one kind from the counts: a chip in the field, the line over it; Backspace in the empty field drops it', async () => {
    await mount()
    await open()
    await type('press')
    const exercises = $$('.g-rchip').find(b => b.textContent.includes('exercises'))
    await act(async () => exercises.click())
    expect(useSearch.getState().group).toBe('exercises')
    expect($('.g-ssf-scope').textContent).toBe('Exercises')
    expect($('.search-sum').textContent).toMatch(/exercises? with “press”\. × on the chip shows everything again\./)
    expect(options().length).toBeGreaterThan(0)
    await type('')
    await key('Backspace')
    expect(useSearch.getState().group).toBe(null)
  })

  it('only workouts: every match, a section a month, newest first', async () => {
    const bench = CATALOGUE.find(e => e.n === 'barbell bench press')
    const workout = (id, d) => ({ id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T18:52:00'), name: 'Push A', entries: [{ id: bench.id, sets: [{ w: 80, r: 5, done: true }] }], prs: [] })
    useStore.setState({ S: { ...structuredClone(DEF), workouts: [workout('w2', '2025-09-28'), workout('w1', '2025-10-12'), workout('w3', '2025-10-05')] } })
    await mount()
    await open()
    await type('push')
    await act(async () => useSearch.setState({ group: 'workouts' }))
    await wait(50)
    const groups = [...list().querySelectorAll('[role="group"]')]
    expect(groups.map(g => document.getElementById(g.getAttribute('aria-labelledby'))?.textContent)).toEqual(['October 2025', 'September 2025'])
    expect([...groups[0].querySelectorAll('[role="option"]')].map(o => o.id)).toEqual(['sr-workout_w1', 'sr-workout_w3'])
    expect($('.search-sum').textContent).toContain('3 workouts with “push”, newest first')
  })

  it('a feature that is off: one card with Turn on and Features, before the rest, and not an option', async () => {
    signedIn()
    await mount()
    await open()
    await type('fasting')
    const card = $('.g-sfeat')
    expect(card.textContent).toContain('Off')
    expect([...card.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Turn on Fasting', 'Features'])
    expect(list().contains(card)).toBe(false)
    await act(async () => [...card.querySelectorAll('button')][1].click())
    expect(navigate).toHaveBeenCalledWith('/me/features', expect.objectContaining({ state: expect.objectContaining({ find: 'Fasting' }) }))
  })

  it('Open Food Facts says "Searching…" only once it has really asked: not while it waits out the debounce', async () => {
    const nt = signedIn()
    nt.hold('GET', '/nt/api/proxy')
    const asked = () => nt.requests.filter(r => r.path.startsWith('/nt/api/proxy')).length
    await mount()
    await open()
    await type('press')
    // Settled, but Open Food Facts not asked yet: no "Searching…", and your own results are there.
    expect(options().length).toBeGreaterThan(0)
    expect(asked()).toBe(0)
    expect(document.body.textContent).not.toContain('Searching Open Food Facts…')
    await wait(600)
    expect(asked()).toBe(1)
    expect(list().textContent).toContain('Searching Open Food Facts…')
    expect($$('#gains-search .g-ssect h2').map(h => h.textContent)).toContain('Open Food Facts')
  })

  it('nothing of yours matches while Open Food Facts asks: Nothing matches at once, "Searching…" first among the ways on', async () => {
    const nt = signedIn()
    nt.hold('GET', '/nt/api/proxy')
    await mount()
    await open()
    await type('zzqx')
    expect($('#gains-search .g-sempty b').textContent).toBe('Nothing matches “zzqx”')
    await wait(600)
    const rows = [...list().querySelector('[role="group"]').querySelectorAll('.g-srow-title')].map(r => r.textContent)
    expect(rows[0]).toBe('Searching Open Food Facts…')
    expect(rows.slice(1)).toEqual(['Create food “zzqx”', 'Create exercise “zzqx”'])
  })

  it('Open Food Facts that fails with nothing of yours matching: Nothing matches, "Couldn’t reach · Try again" first, then Create food and Create exercise', async () => {
    const nt = signedIn()
    nt.failNext('GET', '/nt/api/proxy', { status: 500 })
    const asked = () => nt.requests.filter(r => r.path.startsWith('/nt/api/proxy')).length
    await mount()
    await open()
    await type('zzqy')
    await wait(700)
    expect($('#gains-search .g-sempty b').textContent).toBe('Nothing matches “zzqy”')
    const opts = options()
    expect(opts.map(o => o.id)).toEqual(['sr-note_online', 'sr-none_create-food', 'sr-none_create-exercise'])
    const row = $('#sr-note_online')
    expect(row.getAttribute('role')).toBe('option')
    expect(row.textContent).toContain('Couldn’t reach Open Food Facts')
    expect(row.textContent).toContain('Try again')
    expect(list().textContent).not.toContain('Search Open Food Facts')
    const before = asked()
    await act(async () => row.click())
    await wait(50)
    expect(asked()).toBe(before + 1)
  })

  it('offline: your own results work, and the Open Food Facts row is left out', async () => {
    signedIn()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await mount()
    await open()
    await type('nutella')
    await wait(50)
    expect($('#sr-note_online')).toBeNull()
    expect($('#sr-online-ask')).toBeNull()
    expect(document.body.textContent).not.toContain('Searching Open Food Facts…')
    expect($$('#gains-search .g-ssect h2').map(h => h.textContent)).not.toContain('Open Food Facts')
  })

  it('with reduced motion still opens, scrolls and answers the keys', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await mount()
    await open()
    await type('history')
    expect($('.g-best')).not.toBeNull()
    await key('ArrowDown')
    expect(pill().getAttribute('aria-activedescendant')).toBeTruthy()
  })

  it('the results are a listbox of groups named by their headings, every row an option with a unique id', async () => {
    await mount()
    await open()
    // A page, settings and exercises: three groups.
    await type('rest')
    const all = options()
    expect(all.length).toBeGreaterThan(3)
    expect(all.map(o => o.id)).toEqual([...new Set(all.map(o => o.id))])
    for (const o of all) {
      expect(o.getAttribute('aria-selected')).toBe('false')
      expect(o.tabIndex).toBe(-1)
      // No control inside an option.
      expect(o.querySelector('button, a, input')).toBeNull()
    }
    const groups = [...list().querySelectorAll('[role="group"]')]
    expect(groups.length).toBeGreaterThan(1)
    for (const g of groups) expect(document.getElementById(g.getAttribute('aria-labelledby')).tagName).toBe('H2')
  })

  it('walks the options with the arrows from group to group, Home and End, and Enter activates the active one', async () => {
    await mount()
    await open()
    await type('rest')
    const groupOf = el => el.closest('[role="group"]')?.getAttribute('aria-labelledby') || null
    const seen = []
    for (let i = 0; i < options().length; i++) {
      await key('ArrowDown')
      const el = document.getElementById(pill().getAttribute('aria-activedescendant'))
      expect(el).toBe(options()[i])
      expect(options().filter(o => o.getAttribute('aria-selected') === 'true')).toEqual([el])
      seen.push(groupOf(el))
    }
    // It crossed from one group into the next without stopping.
    expect(new Set(seen.filter(Boolean)).size).toBeGreaterThan(1)
    await key('Home')
    expect(pill().getAttribute('aria-activedescendant')).toBe(options()[0].id)
    await key('End')
    expect(pill().getAttribute('aria-activedescendant')).toBe(options().at(-1).id)
    // Up from the first option leaves the list.
    await key('Home')
    await key('ArrowUp')
    expect(pill().hasAttribute('aria-activedescendant')).toBe(false)
    // Enter on an option in the second group opens it.
    const target = options().find(o => groupOf(o) && groupOf(o) !== groupOf(options().find(x => groupOf(x))))
    while (pill().getAttribute('aria-activedescendant') !== target.id) await key('ArrowDown')
    const opened = vi.spyOn(target, 'click')
    await key('Enter')
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('before typing: Recent is a group of the listbox, and the arrows walk its entries and their ×, but not the chips or Clear', async () => {
    addRecent({ kind: 'query', query: 'squat' })
    addRecent({ kind: 'result', type: 'page', id: '/train/history', label: 'History', query: 'hist' })
    await mount()
    await open()
    const names = options().map(o => o.getAttribute('aria-label') || o.textContent.trim())
    expect(names).toEqual([expect.stringContaining('History'), 'Remove History from recent', expect.stringContaining('squat'), 'Remove squat from recent'])
    const headings = new Set(options().map(o => document.getElementById(o.closest('[role="group"]').getAttribute('aria-labelledby')).textContent))
    expect([...headings]).toEqual(['Recent'])
    // Down to the second ×, Enter: "squat" goes, and the arrows are handed to the entry before it.
    for (let i = 0; i < 4; i++) await key('ArrowDown')
    expect(pill().getAttribute('aria-activedescendant')).toBe('sr-x_q_squat')
    await key('Enter')
    expect(useRecents.getState().list.map(r => r.query)).toEqual(['hist'])
    expect(document.getElementById(pill().getAttribute('aria-activedescendant'))?.getAttribute('aria-label')).toContain('History')
  })

  it('a Recent food whose list has not loaded yet shows from what Recent kept, and searches for it on a tap', async () => {
    addRecent({ kind: 'result', type: 'food', id: 99, label: 'Greek yogurt 2%', query: 'yog' })
    await mount()
    await open()
    const row = options()[0]
    expect(row.textContent).toContain('Greek yogurt 2%')
    expect(row.textContent).toContain('Your food')
    expect(useRecents.getState().list).toHaveLength(1)
    await act(async () => row.click())
    expect(useSearch.getState().query).toBe('Greek yogurt 2%')
  })

  it('a recent query refills the field', async () => {
    addRecent({ kind: 'query', query: 'squat' })
    await mount()
    await open()
    await act(async () => options()[0].click())
    expect(useSearch.getState().query).toBe('squat')
  })

  it('a result in both Recent and Suggested shows once, in Recent', async () => {
    addRecent({ kind: 'result', type: 'page', id: '/train/history', label: 'History', query: '' })
    noteOpened('page:/train/history')
    noteOpened('page:/train/history')
    await mount()
    await open()
    const ids = options().map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id === 'sr-page__train_history')).toHaveLength(1)
  })

  it('the field shows the query only while the overlay does', async () => {
    await mount()
    await open()
    await type('history')
    await key('ArrowDown')
    await key('Enter')
    expect(useSearch.getState()).toMatchObject({ open: false, live: true, query: 'history' })
    expect(pill().value).toBe('')
    expect(pill().getAttribute('aria-expanded')).toBe('false')
  })

  it('a back press that ends the visit lets go of the field; focused again, it opens again', async () => {
    await mount()
    await open()
    expect(document.activeElement).toBe(pill())
    // Android back: the pop lands under the overlay's entry.
    await act(async () => syncSearchWithHistory({ idx: 0 }))
    expect(useSearch.getState().live).toBe(false)
    expect(document.activeElement).not.toBe(pill())
    await open()
    expect(useSearch.getState().open).toBe(true)
  })

  it('while searching the header is avatar, field and ×: a context readout steps out and comes back on close', async () => {
    const ctx = () => $$('button').find(b => b.getAttribute('aria-label') === 'Context')
    await mount('/home', <button type="button" className="hdr-left" aria-label="Context">c</button>)
    expect(ctx().closest('.g-shdr-act').nextElementSibling).toBe(closeX())
    await open()
    expect(ctx()).toBeUndefined()
    expect([...$('.g-shdr-pin').children].filter(c => !c.matches('h1')).map(c => c.className.split(' ')[0])).toEqual(['g-sbtn', 'g-spill', 'g-sbtn'])
    await act(async () => closeX().click())
    expect(ctx().closest('.g-shdr-act').nextElementSibling).toBe(closeX())
  })

  it('speaks the results once typing has stopped, in one polite region', async () => {
    await mount()
    await open()
    await type('history')
    await wait(700)
    const live = $$('[role="status"]').find(el => el.getAttribute('aria-live') === 'polite' && el.closest('#gains-search'))
    expect(live.textContent).toMatch(/results?:/)
  })
})
