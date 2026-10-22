// @vitest-environment happy-dom
// Profile's Nutrition group, its search entries and the settings gate, against the fake hub.
// Diary, Water, Foods and Food sources are tested in views/settings/pages/settings-food.test.jsx,
// Categories and Custom units in views/settings/pages/CategoriesPage.test.jsx and CustomUnitsPage.test.jsx.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { createFakeNutriTrace } from '../lib/nutrition/fake-nutritrace.js'
import { pageExists, pageVisible, searchSettings } from '../views/settings-pages.js'
import { ROOT_GROUPS } from '../views/settings/root-groups.js'
import NtSettingsGate from './NtSettingsGate.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, nt
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)) })
const click = async el => { await act(async () => { el.click() }); await settle() }

function Loaded() {
  return <p data-testid="loaded">Loaded</p>
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('the Nutrition group, the search and Features', () => {
  const web = { user: { id: 'u' }, mobile: false, nutrition: true }
  const NEW_PAGES = ['water', 'foods', 'sources', 'categories', 'customUnits']

  it('puts every page in the Nutrition group, on the web app signed in only', () => {
    expect(ROOT_GROUPS.find(g => g.key === 'food').rows.map(r => r.id)).toEqual(['goals', 'diary', ...NEW_PAGES])
    for (const id of NEW_PAGES) {
      expect(pageVisible(id, web), id).toBe(true)
      expect(pageVisible(id, { ...web, nutrition: false }), id).toBe(false)
      expect(pageExists(id, { user: { id: 'u' }, mobile: false }), id).toBe(true)
      expect(pageExists(id, { user: { id: 'u' }, mobile: true }), id).toBe(false)
      expect(pageExists(id, { user: null, mobile: false }), id).toBe(false)
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
    nt = createFakeNutriTrace({ settings: { timeFormat: '24h' } })
    nt.failNext('GET', '/nt/api/settings', { status: 500 })
    vi.stubGlobal('fetch', nt.fetch)
    act(() => root.render(<NtSettingsGate><Loaded /></NtSettingsGate>))
    await settle()
    expect(host.querySelector('[role="alert"]').textContent).toBe('Your settings did not load.')
    expect(host.querySelector('[data-testid="loaded"]')).toBeNull()
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Try again'))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelector('[data-testid="loaded"]')).not.toBeNull()
  })
})
