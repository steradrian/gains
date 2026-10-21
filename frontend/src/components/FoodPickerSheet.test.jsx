// @vitest-environment happy-dom
// Log food (board T1.4): the design system drawer behind Today's Log food, the meal pills and the +
// sheet. NutriTrace is faked at the fetch boundary. The search itself (Open Food Facts, creating,
// scanning) is the shared one, pinned in FoodSearch.test.jsx; this pins the drawer.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { resetOffBudget } from '../lib/nutrition/off-budget.js'
import { resetOnlineSearch } from '../lib/nutrition/use-online-search.js'
import { createFakeNutriTrace, fixtureDay, fixtureFoods } from '../lib/nutrition/fake-nutritrace.js'
import { foodPickerSheet } from './FoodPickerSheet.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const settle = async (ms = 0) => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const open = async () => {
  await act(async () => { root.render(<Sheets />) })
  await act(async () => { foodPickerSheet() })
  await settle()
  return host.querySelector('[data-sheet] .g-bs')
}
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
const click = async el => { await act(async () => { el.click() }); await settle() }
const typeInto = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle(260)
}
const rows = drawer => [...drawer.querySelectorAll('.g-lf-row .g-lf-title')].map(n => n.textContent)
const row = (drawer, title) => [...drawer.querySelectorAll('.g-lf-row')].find(r => r.querySelector('.g-lf-title').textContent === title)
const button = (scope, label) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const tab = (drawer, label) => [...drawer.querySelectorAll('.g-seg button')].find(b => b.textContent === label)

function install(opts = {}) {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) }, ...opts })
  nt.state.settings.diaryPromptQuantity = false
  vi.stubGlobal('fetch', nt.fetch)
}

beforeEach(() => {
  install()
  useStore.setState(s => ({
    user: { id: 3, name: 'Ana' },
    pushState: vi.fn(async () => {}),
    S: { ...s.S, routines: [], workouts: [], dayPlan: {}, week: {}, active: null, checkIn: false, unit: 'kg' },
  }))
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useDiarySelection.getState().setMeal(1)
  resetOnlineSearch()
  resetOffBudget()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the Log food drawer', () => {
  it('is the full design system drawer for the day and meal, its search and sources pinned above the rows', async () => {
    const drawer = await open()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(drawer.classList.contains('g-bs-full')).toBe(true)
    expect(drawer.querySelector('h2').textContent).toBe('Log food')
    expect(drawer.querySelector('.g-bs-chip').textContent).toBe('Today · Lunch')
    expect(drawer.querySelector('.g-bs-pin input[type="search"]').getAttribute('aria-label')).toBe('Search foods')
    expect([...drawer.querySelectorAll('.g-bs-pin .g-seg button')].map(b => b.textContent)).toEqual(['Recent', 'Saved meals', 'My foods'])
    expect(rows(drawer)).toEqual(['Rolled oats', 'Wholemeal bread', 'Quick kcal'])
    expect([...drawer.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Scan', 'Create a food'])
    expect(button(drawer, 'Scan').className).toContain('g-btn-secondary')
  })

  it('logs a food in a tap to the day and meal, closes, and the toast says where with Undo', async () => {
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ name: 'Rolled oats', meal: 1 })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('Added Rolled oats to Today, Lunch')
    expect(useUI.getState().toastAction.label).toBe('Undo')
  })

  it('Saved meals lists meals and recipes and logs one in a tap; My foods lists every food', async () => {
    const drawer = await open()
    await click(tab(drawer, 'Saved meals'))
    expect(rows(drawer)).toEqual(['Oats and bread', 'Lentil soup'])
    await click(tab(drawer, 'My foods'))
    expect(rows(drawer)).toEqual(['Rolled oats', 'Wholemeal bread', 'Crème fraîche'])
    await click(tab(drawer, 'Saved meals'))
    await click(row(drawer, 'Oats and bread'))
    expect(nt.state.days[TODAY].items.filter(i => i.meal === 1).map(i => i.name)).toEqual(expect.arrayContaining(['Rolled oats', 'Wholemeal bread']))
    expect(useUI.getState().toastMsg).toBe('Added Oats and bread to Today, Lunch')
  })

  it('typing trades the sources for what matches, and the × clears it', async () => {
    const drawer = await open()
    await typeInto(drawer.querySelector('.g-lf-search input'), 'bread')
    expect(drawer.querySelector('.g-seg')).toBeNull()
    expect([...drawer.querySelectorAll('.g-lf-sec')].map(h => h.textContent)).toContain('Your foods')
    expect(rows(drawer)).toContain('Wholemeal bread')
    expect(rows(drawer)).not.toContain('Rolled oats')
    button(drawer, 'Clear').focus()
    await click(button(drawer, 'Clear'))
    expect(drawer.querySelector('.g-lf-search input').value).toBe('')
    expect(drawer.querySelector('.g-seg')).not.toBeNull()
    // The × is gone with the query; focus stays in the drawer, back on the field.
    expect(document.activeElement).toBe(drawer.querySelector('.g-lf-search input'))
  })

  it('lifts the drawer over the keyboard the search raises, so Scan and Create a food stay in reach', async () => {
    const before = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 560, offsetTop: 0, addEventListener() {}, removeEventListener() {} } })
    try {
      const drawer = await open()
      expect(drawer.style.getPropertyValue('--picker-keyboard-bottom')).toBe('340px')
      expect(drawer.style.getPropertyValue('--picker-visual-height')).toBe('560px')
    } finally {
      if (before) Object.defineProperty(window, 'visualViewport', before); else delete window.visualViewport
      if (height) Object.defineProperty(window, 'innerHeight', height); else delete window.innerHeight
    }
  })

  // Edge table: no recent foods.
  it('with no recent foods, Recent opens on suggested foods and Scan leads', async () => {
    install({ foods: fixtureFoods().map(f => ({ ...f, last_used_at: null })) })
    const drawer = await open()
    expect(drawer.querySelector('.g-lf-sec').textContent).toBe('Suggested foods')
    expect(rows(drawer)).toEqual(['Rolled oats', 'Wholemeal bread', 'Crème fraîche', 'Quick kcal'])
    expect(button(drawer, 'Scan').className).toContain('g-btn-primary')
  })

  it('with no foods at all, says where they will show', async () => {
    install({ foods: [] })
    const drawer = await open()
    expect(drawer.querySelector('.g-lf-note').textContent).toBe('Foods you log show up here. Search to find one.')
    expect(button(drawer, 'Scan').className).toContain('g-btn-primary')
  })

  // Edge table: logging to a past day.
  it('names a past day and its meal in the chip, and logs there', async () => {
    const day = '2026-10-13'
    install({ days: { [TODAY]: fixtureDay(TODAY), [day]: fixtureDay(day) } })
    useDiarySelection.getState().setDate(day)
    useDiarySelection.getState().setMeal(2)
    const drawer = await open()
    expect(drawer.querySelector('.g-bs-chip').textContent).toBe(`${fmtDate(day, true)} · Dinner`)
    await click(row(drawer, 'Wholemeal bread'))
    expect(nt.state.days[day].items.at(-1)).toMatchObject({ name: 'Wholemeal bread', meal: 2 })
    expect(useUI.getState().toastMsg).toBe(`Added Wholemeal bread to ${fmtDate(day, true)}, Dinner`)
  })

  it('the chip picks another meal for this drawer', async () => {
    const drawer = await open()
    await click(drawer.querySelector('.g-bs-chip'))
    await click([...lastSheet().querySelectorAll('.menu-item')].find(m => m.textContent === 'Snacks'))
    expect(drawer.querySelector('.g-bs-chip').textContent).toBe('Today · Snacks')
    await click(row(drawer, 'Rolled oats'))
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ name: 'Rolled oats', meal: 3 })
  })

  // Edge table: midnight.
  it('opened before midnight, keeps writing to the day it opened on', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-20T23:58:00'))
    install({ days: { '2026-10-20': fixtureDay('2026-10-20'), '2026-10-21': fixtureDay('2026-10-21') } })
    const drawer = await open()
    vi.setSystemTime(new Date('2026-10-21T00:02:00'))
    await click(row(drawer, 'Rolled oats'))
    expect(nt.state.days['2026-10-20'].items.at(-1)).toMatchObject({ name: 'Rolled oats', meal: 1 })
    expect(nt.state.days['2026-10-21'].items.some(i => i.uuid === nt.state.days['2026-10-20'].items.at(-1).uuid)).toBe(false)
  })
})
