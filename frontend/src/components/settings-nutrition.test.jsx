// @vitest-environment happy-dom
// Profile's NutriTrace-backed rows (ia-proposal §5), against the fake hub: Features holds the
// Fasting switch whose Fast row then shows in the + sheet. (Diary & meals is tested in
// views/settings/pages/settings-food.test.jsx.)
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useFastingOn } from '../lib/nutrition/use-fasting.js'
import { createFakeNutriTrace, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import { pageExists, pageVisible, searchSettings } from '../views/settings-pages.js'
import FeaturesPage from '../views/settings/pages/FeaturesPage.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, nt
const toast = vi.fn()
const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)) })
const puts = () => nt.requests.filter(r => r.method === 'PUT' && r.path === '/nt/api/settings')

function setUp(settings = {}) {
  nt = createFakeNutriTrace({ settings: { ...fixtureSettings(), ...settings } })
  vi.stubGlobal('fetch', nt.fetch)
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useUI.setState({ toast })
  useNutrition.getState().reset()
  toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('Features › Fasting', () => {
  // The Features page's rows are glass rows: the title is the row's <b>.
  const glassRow = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)

  function Harness() {
    const plusRow = useFastingOn()
    return <>
      <FeaturesPage />
      <span className="plus-fast">{plusRow ? 'fast row' : 'no fast row'}</span>
    </>
  }

  it('turning it on writes fastingEnabled and the + sheet gets its Fast row', async () => {
    setUp({ fastingEnabled: false })
    await act(async () => { await useNutrition.getState().loadSettings() })
    act(() => root.render(<Harness />))
    await settle()
    expect(host.querySelector('.plus-fast').textContent).toBe('no fast row')
    await act(async () => { glassRow('Fasting').querySelector('[role="switch"]').click() })
    await settle()
    expect(puts().map(r => r.body)).toEqual([{ key: 'fastingEnabled', value: true }])
    expect(host.querySelector('.plus-fast').textContent).toBe('fast row')
    expect(glassRow('Fasting').querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
  })

  it('settings that did not load say so with Try again, instead of a switch that never wakes', async () => {
    setUp({ fastingEnabled: false })
    // The page asks for the settings itself when it opens (useNtSettings), so that is the request that fails.
    nt.failNext('GET', '/nt/api/settings', { status: 500 })
    act(() => root.render(<Harness />))
    await settle()
    expect(glassRow('Fasting').textContent).toContain('Your settings did not load.')
    expect(glassRow('Fasting').querySelector('[role="switch"]')).toBeNull()
    await act(async () => { [...glassRow('Fasting').querySelectorAll('button')].find(b => b.textContent === 'Try again').click() })
    await settle()
    const sw = glassRow('Fasting').querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(sw.disabled || sw.getAttribute('aria-disabled') === 'true').toBe(false)
  })
})

describe('where the nutrition rows show', () => {
  const web = { user: { id: 'u' }, mobile: false, nutrition: true }
  it('only where nutrition is reachable: the web app, signed in', () => {
    expect(pageVisible('goals', web)).toBe(true)
    expect(pageVisible('diary', { ...web, nutrition: false })).toBe(false)
    expect(pageExists('diary', { user: { id: 'u' }, mobile: false })).toBe(true)
    expect(pageExists('diary', { user: { id: 'u' }, mobile: true })).toBe(false)
    expect(pageExists('diary', { user: null, mobile: false })).toBe(false)
    expect(pageExists('goals', web)).toBe(false)   // it lives on Nutrition › Goals
  })
  it('the search finds them, and the calorie goal mode on Goals', () => {
    const tr = s => s
    expect(searchSettings('calorie goal', web, tr)[0]).toMatchObject({ page: 'goals', isPage: true })
    expect(searchSettings('fasting', web, tr).map(h => h.title)).toContain('Fasting')
    expect(searchSettings('fasting', { ...web, fastingOn: true }, tr).map(h => h.title)).toContain('Default fasting plan')
    expect(searchSettings('activity', web, tr).map(h => h.title)).toContain('Show activity under meals')
    expect(searchSettings('fasting', { ...web, nutrition: false }, tr)).toEqual([])
  })
})
