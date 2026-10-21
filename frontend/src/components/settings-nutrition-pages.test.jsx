// @vitest-environment happy-dom
// Profile's Nutrition pages (ia-proposal §5) against the fake hub, which holds every write to the
// rules of fitness-hub src/nt-body-checks.ts: Categories and Custom units (the pages not rebuilt
// yet). Diary, Water, Foods and Food sources are tested in views/settings/pages/settings-food.test.jsx.
// Each save is one { key, value } the hub takes, and a refused one keeps what was typed and says so.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { createFakeNutriTrace, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import { pageExists, pageVisible, ROOT_GROUPS, SEARCH, searchSettings } from '../views/settings-pages.js'
import { bindUI } from './ui.jsx'
import CustomUnitsSettings from './CustomUnitsSettings.jsx'
import FoodCategoriesSettings from './FoodCategoriesSettings.jsx'
import NtSettingsGate from './NtSettingsGate.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const PAGES = { categories: FoodCategoriesSettings, customUnits: CustomUnitsSettings }

let host, root, nt, sheets, sheetRoots
const toast = vi.fn()
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)) })
const puts = () => nt.requests.filter(r => r.method === 'PUT' && r.path === '/nt/api/settings').map(r => r.body)
const rowTitled = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const titles = () => [...host.querySelectorAll('.lrow .lrow-t')].map(e => e.textContent)
const click = async el => { await act(async () => { el.click() }); await settle() }

// The sheet the last tap opened, mounted next to the page. `close` is what the sheet was given.
function openedSheet() {
  const render = sheets.at(-1)
  const box = document.createElement('div')
  document.body.appendChild(box)
  const sheetRoot = createRoot(box)
  const close = vi.fn()
  act(() => sheetRoot.render(render(close)))
  sheetRoots.push([sheetRoot, box])
  return { box, close }
}
const fieldOf = (box, label) => box.querySelector(`input[aria-label="${label}"]`)
const buttonOf = (box, label) => [...box.querySelectorAll('button')].find(b => b.textContent === label)
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// A fresh page over a fresh hub; a second mount in one test starts from nothing, as a new visit.
async function mount(page, settings = {}) {
  act(() => root.render(null))
  useNutrition.getState().reset()
  nt = createFakeNutriTrace({ settings: { timeFormat: '24h', ...settings } })
  vi.stubGlobal('fetch', nt.fetch)
  const Page = PAGES[page]
  act(() => root.render(<NtSettingsGate><Page /></NtSettingsGate>))
  await settle()
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  sheets = []
  sheetRoots = []
  useUI.setState({ toast, openSheet: render => { sheets.push(render); return { close: vi.fn() } } })
  bindUI(useUI)
  useNutrition.getState().reset()
  toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  for (const [r, box] of sheetRoots) { act(() => r.unmount()); box.remove() }
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('Categories', () => {
  it('adds a name alone as a plain string and a labelled one as { name, label }', async () => {
    await mount('categories')
    await click(rowTitled('Add a category'))
    let { box } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Dairy')
    await click(buttonOf(box, 'Add'))
    await click(rowTitled('Add a category'))
    ;({ box } = openedSheet())
    await type(fieldOf(box, 'Name'), 'Fruit')
    await type(fieldOf(box, 'Label (an emoji, optional)'), '🍎')
    await click(buttonOf(box, 'Add'))
    expect(puts()).toEqual([
      { key: 'foodCategories', value: ['Dairy'] },
      { key: 'foodCategories', value: ['Dairy', { name: 'Fruit', label: '🍎' }] },
    ])
    expect(titles()).toEqual(['Dairy', '🍎 Fruit', 'Add a category'])
  })

  it('refuses a repeated name and a label over 16 characters before asking the hub', async () => {
    await mount('categories', { foodCategories: ['Dairy'] })
    await click(rowTitled('Add a category'))
    const { box } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Dairy')
    await click(buttonOf(box, 'Add'))
    expect(box.querySelector('[role="alert"]').textContent).toBe('You already have a category with that name.')
    expect(puts()).toEqual([])
  })

  it('removes one whichever shape it is stored in, and writes the rest in the shapes NutriTrace uses', async () => {
    await mount('categories', { foodCategories: ['Dairy', { name: 'Fruit', label: '🍎' }, { name: 'Veg', label: '' }] })
    await click(rowTitled('Dairy').querySelector('button'))
    expect(puts()).toEqual([{ key: 'foodCategories', value: [{ name: 'Fruit', label: '🍎' }, 'Veg'] }])
  })
})

describe('Custom units', () => {
  it('adds { abbr, full }, the full name defaulting to the abbreviation', async () => {
    await mount('customUnits')
    await click(rowTitled('Add a custom unit'))
    let { box } = openedSheet()
    await type(fieldOf(box, 'Abbreviation'), 'shot')
    await type(fieldOf(box, 'Full name (optional)'), 'shot glass')
    await click(buttonOf(box, 'Add'))
    await click(rowTitled('Add a custom unit'))
    ;({ box } = openedSheet())
    await type(fieldOf(box, 'Abbreviation'), 'scoop')
    await click(buttonOf(box, 'Add'))
    expect(puts().at(-1)).toEqual({ key: 'customUnits', value: [{ abbr: 'shot', full: 'shot glass' }, { abbr: 'scoop', full: 'scoop' }] })
    expect(rowTitled('shot glass').querySelector('.lrow-s').textContent).toBe('shot')
  })

  it('refuses a unit the built-in list has, with no request, and keeps the typing', async () => {
    await mount('customUnits')
    await click(rowTitled('Add a custom unit'))
    const { box, close } = openedSheet()
    await type(fieldOf(box, 'Abbreviation'), 'Cup')
    await click(buttonOf(box, 'Add'))
    expect(box.querySelector('[role="alert"]').textContent).toBe('That unit is already in the list.')
    expect(fieldOf(box, 'Abbreviation').value).toBe('Cup')
    expect(puts()).toEqual([])
    expect(close).not.toHaveBeenCalled()
  })

  it('removes one and drops a gram weight an older client may have stored', async () => {
    await mount('customUnits', { customUnits: [{ abbr: 'shot', full: 'shot glass' }, { abbr: 'stick', grams: 8 }] })
    await click(rowTitled('shot glass').querySelector('button'))
    expect(puts()).toEqual([{ key: 'customUnits', value: [{ abbr: 'stick', full: 'stick' }] }])
  })
})

describe('a list is changed over what the server has now, not over what the page loaded', () => {
  it('categories and custom units: an add keeps what was added elsewhere', async () => {
    await mount('categories', { foodCategories: ['Dairy'] })
    nt.state.settings.foodCategories = ['Dairy', 'Fish']
    await click(rowTitled('Add a category'))
    let { box } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Fruit')
    await click(buttonOf(box, 'Add'))
    expect(puts().at(-1)).toEqual({ key: 'foodCategories', value: ['Dairy', 'Fish', 'Fruit'] })
    await mount('customUnits', { customUnits: [{ abbr: 'shot', full: 'shot' }] })
    nt.state.settings.customUnits = [{ abbr: 'shot', full: 'shot' }, { abbr: 'scoop', full: 'scoop' }]
    await click(rowTitled('Add a custom unit'))
    ;({ box } = openedSheet())
    await type(fieldOf(box, 'Abbreviation'), 'stick')
    await click(buttonOf(box, 'Add'))
    expect(puts().at(-1).value.map(u => u.abbr)).toEqual(['shot', 'scoop', 'stick'])
  })

  it('a failed re-read saves nothing and says so', async () => {
    await mount('categories', { foodCategories: ['Dairy'] })
    await click(rowTitled('Add a category'))
    const { box, close } = openedSheet()
    await type(fieldOf(box, 'Name'), 'Fruit')
    nt.failNext('GET', '/nt/api/settings', 'offline')
    await click(buttonOf(box, 'Add'))
    expect(puts()).toEqual([])
    expect(box.querySelector('[role="alert"]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(close).not.toHaveBeenCalled()
  })
})

describe('the Nutrition group, the search and Features', () => {
  const web = { user: { id: 'u' }, mobile: false, nutrition: true }
  const NEW_PAGES = ['water', 'foods', 'sources', 'categories', 'customUnits']

  it('puts every page in the Nutrition group, on the web app signed in only', () => {
    expect(ROOT_GROUPS.find(g => g.title === 'Nutrition').ids).toEqual(['goals', 'diary', ...NEW_PAGES])
    for (const id of NEW_PAGES) {
      expect(pageVisible(id, web), id).toBe(true)
      expect(pageVisible(id, { ...web, nutrition: false }), id).toBe(false)
      expect(pageExists(id, { user: { id: 'u' }, mobile: false }), id).toBe(true)
      expect(pageExists(id, { user: { id: 'u' }, mobile: true }), id).toBe(false)
      expect(pageExists(id, { user: null, mobile: false }), id).toBe(false)
    }
  })

  it('every search entry on these pages is a row on the page', async () => {
    for (const page of Object.keys(PAGES)) {
      await mount(page, fixtureSettings())
      const ctx = { ...web, ntSettings: nt.state.settings, fastingOn: true }
      const want = SEARCH.filter(e => e.page === page && (!e.when || e.when(ctx))).map(e => e.title)
      expect(want.length, page).toBeGreaterThan(0)
      for (const title of want) expect(titles(), `${page}: ${title}`).toContain(title)
    }
  })

  it('the search finds the pages and their rows', () => {
    const tr = s => s
    expect(searchSettings('water', web, tr)[0]).toMatchObject({ page: 'water', isPage: true })
    expect(searchSettings('open food facts', web, tr).map(h => h.title)).toEqual(expect.arrayContaining(['Food sources', 'Search Open Food Facts']))
    expect(searchSettings('emoji', web, tr).map(h => h.title)).toContain('Add a category')
    expect(searchSettings('scoop', web, tr).map(h => h.title)).toContain('Add a custom unit')
    expect(searchSettings('barcode', web, tr).map(h => h.title)).toContain('Beep when a barcode scans')
    // "water" still finds the Watermelon accent, but no nutrition page.
    expect(searchSettings('water', { ...web, nutrition: false }, tr).filter(h => h.page !== 'appearance')).toEqual([])
  })

  it('hides the rows that depend on another switch, as the page does', () => {
    const tr = s => s
    expect(searchSettings('search language', { ...web, ntSettings: { offEnabled: false } }, tr).map(h => h.title)).not.toContain('Search language')
    expect(searchSettings('search language', { ...web, ntSettings: {} }, tr).map(h => h.title)).toContain('Search language')
    expect(searchSettings('wearable manual', { ...web, ntSettings: { diaryShowActivity: true } }, tr).map(h => h.title)).not.toContain('Wearable and manual entries')
  })
})

describe('NtSettingsGate', () => {
  it('says the settings did not load, with Try again, and shows the page once they do', async () => {
    useNutrition.getState().reset()
    nt = createFakeNutriTrace({ settings: { timeFormat: '24h' } })
    nt.failNext('GET', '/nt/api/settings', { status: 500 })
    vi.stubGlobal('fetch', nt.fetch)
    act(() => root.render(<NtSettingsGate><FoodCategoriesSettings /></NtSettingsGate>))
    await settle()
    expect(host.querySelector('[role="alert"]').textContent).toBe('Your settings did not load.')
    expect(host.querySelector('.empty')).toBeNull()
    expect(titles()).toEqual([])
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Try again'))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(titles()).toContain('Add a category')
  })
})
