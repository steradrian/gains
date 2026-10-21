// @vitest-environment happy-dom
// Log food (boards T1.4, Ea8*): the design system drawer behind Today's Log food, the meal pills and
// the + sheet, a stack of steps (results, Amount, A food in full, Logging to, Quick calories).
// NutriTrace is faked at the fetch boundary. The search itself (Open Food Facts, creating,
// scanning) is the shared one, pinned in FoodSearch.test.jsx; this pins the drawer and its steps.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setNav } from '../lib/nav.js'
import { backSheet } from '../lib/sheet-nav.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { resetOffBudget } from '../lib/nutrition/off-budget.js'
import { resetOnlineSearch } from '../lib/nutrition/use-online-search.js'
import { createFakeNutriTrace, fixtureDay, fixtureFoods } from '../lib/nutrition/fake-nutritrace.js'
import { applySheetKeyboard } from '../lib/sheet-keyboard.js'
import { foodPickerSheet } from './FoodPickerSheet.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  // a drawer's sub-panels are drawn as sheets of their own here
  return sheets.flatMap(s => [s, ...(s.panels || [])]).map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const settle = async (ms = 0) => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const open = async () => {
  await act(async () => { root.render(<Sheets />) })
  await act(async () => { foodPickerSheet() })
  await settle()
  return host.querySelector('[data-sheet] .g-bs')
}
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
// The harness draws a sub-panel as a sheet of its own: `top()` is the step on screen, `goBack()` is
// what the ‹, Escape and the browser's back do.
const panels = () => useUI.getState().sheets[0]?.panels ?? []
const top = () => lastSheet().querySelector('.g-bs')
const goBack = async () => { await act(async () => { backSheet(useUI.getState(), useUI.getState().sheets[0].id) }); await settle() }
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
    expect([...drawer.querySelectorAll('.g-bs-pin .g-seg button')].map(b => b.textContent)).toEqual(['Search', 'Saved meals', 'Recipes'])
    expect([...drawer.querySelectorAll('.g-lf-sec')].map(h => h.textContent)).toEqual(['Recent', 'Your foods'])
    expect(rows(drawer)).toEqual(['Rolled oats', 'Wholemeal bread', 'Crème fraîche', 'Quick kcal'])
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

  it('Saved meals lists the meals and Recipes the recipes, and a meal logs all its foods in a tap', async () => {
    const drawer = await open()
    await click(tab(drawer, 'Saved meals'))
    expect(drawer.querySelector('.g-lf-sec').textContent).toBe('Saved meals · one tap logs all')
    expect(rows(drawer)).toEqual(['Oats and bread'])
    await click(tab(drawer, 'Recipes'))
    expect(drawer.querySelector('.g-lf-sec').textContent).toBe('Recipes · asks for servings')
    expect(rows(drawer)).toEqual(['Lentil soup'])
    await click(tab(drawer, 'Search'))
    expect(rows(drawer)).toEqual(['Rolled oats', 'Wholemeal bread', 'Crème fraîche', 'Quick kcal'])
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

  it('stands on the keyboard the search raises without being resized by it, so Scan and Create a food stay in reach', async () => {
    const before = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 560, offsetTop: 0, addEventListener() {}, removeEventListener() {} } })
    try {
      const drawer = await open()
      // The lift is the page's (lib/sheet-keyboard.js, on <html>); the drawer carries nothing of its
      // own and keeps its full-height type, which the CSS gives a height rather than a top.
      applySheetKeyboard(window)
      expect(document.documentElement.style.getPropertyValue('--kb')).toBe('340px')
      expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('560px')
      expect(drawer.getAttribute('style')).toBeNull()
      expect(drawer.classList.contains('g-bs-full')).toBe(true)
    } finally {
      if (before) Object.defineProperty(window, 'visualViewport', before); else delete window.visualViewport
      if (height) Object.defineProperty(window, 'innerHeight', height); else delete window.innerHeight
      applySheetKeyboard(window)
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
    expect(drawer.querySelector('.g-sempty').textContent).toContain('Foods you log show up here. Search to find one.')
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

  it('the chip opens Logging to, and a meal picked there is this drawer\'s meal', async () => {
    const drawer = await open()
    await click(drawer.querySelector('.g-bs-chip'))
    expect(top().querySelector('h2').textContent).toBe('Logging to')
    await click([...top().querySelectorAll('[role="radio"]')].find(m => m.textContent.startsWith('Snacks')))
    // The pick takes the panel off, back at the results.
    expect(panels()).toHaveLength(0)
    expect(drawer.querySelector('h2').textContent).toBe('Log food')
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

// Eat logging m1: the steps behind a row (boards Ea8FoodDetail, Ea8Food, Ea8Meal, Ea8Quick,
// Ea8NoMatch, Ea8Offline), each a sub-panel of the drawer.
describe('the steps of the drawer', () => {
  const ask = () => { nt.state.settings.diaryPromptQuantity = true }
  const field = (scope, label) => scope.querySelector(`input[aria-label="${label}"]`)
  afterEach(() => { Reflect.deleteProperty(navigator, 'onLine') })

  it('a row opens Amount as a panel of the drawer that goes back to the results, and the + logs one serving at once', async () => {
    ask()
    const drawer = await open()
    expect(panels()).toHaveLength(0)
    await click(row(drawer, 'Rolled oats'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(panels()).toHaveLength(1)
    expect(top().querySelector('.g-la-name').textContent).toBe('Rolled oats')
    expect(nt.writes()).toHaveLength(0)
    await goBack()
    expect(panels()).toHaveLength(0)
    expect(rows(drawer)).toContain('Rolled oats')
    await click(button(drawer, 'Add Rolled oats to Lunch'))
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ name: 'Rolled oats', meal: 1, portion: 100, unit: 'g', quantity: 1 })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('Added Rolled oats to Today, Lunch')
  })

  it('Amount steps the serving size, the unit chips change its unit, and the numbers follow', async () => {
    ask()
    const drawer = await open()
    await click(row(drawer, 'Wholemeal bread'))
    await click(button(top(), 'More 10 g'))
    expect(field(top(), 'Serving size').value).toBe('110')
    expect(top().querySelector('.g-la-big').textContent).toBe('272 kcal')
    await click([...top().querySelectorAll('.g-la-units button')].find(b => b.textContent === 'slice'))
    await typeInto(field(top(), 'Serving size'), '2')
    expect(top().querySelector('.g-la-big').textContent).toBe('178 kcal')
    await click(button(top(), 'Add to Lunch'))
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ name: 'Wholemeal bread', meal: 1, portion: 2, unit: 'slice', quantity: 1 })
    expect(useUI.getState().toastMsg).toBe('Added Wholemeal bread to Today, Lunch')
  })

  it('Amount says what the meal and the kcal left become, against that day\'s goal', async () => {
    ask()
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    await settle()
    // Lunch holds 450 kcal, the day 678 of 2,200: 380 more.
    expect(top().querySelector('.g-la-after').textContent).toBe('After this, Lunch is 830 kcal and the 1,522 kcal left today goes to 1,142.')
  })

  it('Amount says by how much the day goes over when it does', async () => {
    ask()
    nt.state.settings.goals = { calories: { min: 800, max: 800, sharedGoal: true } }
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    await settle()
    expect(top().querySelector('.g-la-after').textContent).toBe('After this, Lunch is 830 kcal and you are 258 kcal over today.')
  })

  it('Amount leaves the line out without a calorie goal, never assuming 2000', async () => {
    ask()
    nt.state.settings.goals = {}
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    await settle()
    expect(top().querySelector('.g-la-after')).toBeNull()
    expect(top().textContent).not.toContain('2,000')
  })

  it('Amount refuses an amount of nothing', async () => {
    ask()
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    await typeInto(field(top(), 'Servings'), '0')
    expect(button(top(), 'Add to Lunch').disabled).toBe(true)
    expect(top().textContent).toContain('Enter an amount above 0.')
  })

  it('A food in full has only the rows the record has, and Log replaces it and Amount with one Amount', async () => {
    ask()
    const drawer = await open()
    await click(row(drawer, 'Rolled oats'))
    await click(button(top(), 'see it in full'))
    expect(panels()).toHaveLength(2)
    expect(top().querySelector('h2').textContent).toBe('Food')
    const labels = [...top().querySelectorAll('.g-ff-table tbody th')].map(th => th.textContent)
    expect(labels).toContain('Protein')
    // The record carries fiber but no salt or sugars: no row, not a zero.
    expect(labels).toContain('Fiber')
    expect(labels).not.toContain('Salt')
    expect(labels).not.toContain('Sugars')
    expect(button(top(), 'Edit')).toBeDefined()
    await click(button(top(), 'Log'))
    expect(panels()).toHaveLength(1)
    expect(top().querySelector('.g-la-name').textContent).toBe('Rolled oats')
    await goBack()
    expect(panels()).toHaveLength(0)
    expect(rows(drawer)).toContain('Rolled oats')
  })

  it('Save as food keeps an online result in My foods once, and Log then logs that food', async () => {
    ask()
    const drawer = await open()
    await typeInto(drawer.querySelector('.g-lf-search input'), 'nutella')
    await settle(300)
    await click(row(drawer, 'Nutella'))
    await click(button(top(), 'see it in full'))
    expect(top().textContent).toContain('Logging it saves it to your foods first')
    await click(button(top(), 'Save as food'))
    expect(nt.writes().filter(w => w.method === 'POST' && w.path === '/nt/api/foods')).toHaveLength(1)
    expect(button(top(), 'Save as food')).toBeUndefined()
    await click(button(top(), 'Log'))
    await click(button(top(), 'Add to Lunch'))
    expect(nt.writes().filter(w => w.method === 'POST' && w.path === '/nt/api/foods')).toHaveLength(1)
    expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ name: 'Nutella', meal: 1 })
    expect(typeof nt.state.days[TODAY].items.at(-1).food_server_id).toBe('number')
  })

  it('Logging to names what each meal holds on the day, and the pick holds for the drawer and the next half hour', async () => {
    const drawer = await open()
    await click(drawer.querySelector('.g-bs-chip'))
    const meal = name => [...top().querySelectorAll('.g-lm-row')].find(r => r.querySelector('b').textContent === name)
    expect(meal('Breakfast').textContent).toContain('228 kcal logged')
    expect(meal('Lunch').textContent).toContain('450 kcal logged')
    expect(meal('Dinner').textContent).toMatch(/Nothing yet|Now, by the clock/)
    expect(meal('Lunch').getAttribute('aria-checked')).toBe('true')
    expect(top().textContent).toContain('Your pick holds for the next half hour.')
    await click(meal('Snacks'))
    expect(useDiarySelection.getState().meal).toMatchObject({ slot: 3 })
  })

  it('a drawer opened for a day keeps its pick to itself and does not say it holds', async () => {
    const day = '2026-10-13'
    install({ days: { [TODAY]: fixtureDay(TODAY), [day]: fixtureDay(day) } })
    await act(async () => { root.render(<Sheets />) })
    await act(async () => { foodPickerSheet({ date: day, meal: 2 }) })
    await settle()
    const drawer = host.querySelector('[data-sheet] .g-bs')
    await click(drawer.querySelector('.g-bs-chip'))
    expect(top().textContent).not.toContain('Your pick holds')
    expect(top().textContent).toContain('Where this sheet logs.')
    await click([...top().querySelectorAll('.g-lm-row')].find(r => r.querySelector('b').textContent === 'Snacks'))
    expect(drawer.querySelector('.g-bs-chip').textContent).toBe(`${fmtDate(day, true)} · Snacks`)
    expect(useDiarySelection.getState().meal).toMatchObject({ slot: 1 })
  })

  describe('with no match', () => {
    beforeEach(() => { nt.state.settings.offEnabled = false })

    it('offers the nearest spelling only when there is one, and Create food opens the editor prefilled after leaving the drawer', async () => {
      const go = vi.fn()
      setNav(go)
      const drawer = await open()
      await typeInto(drawer.querySelector('.g-lf-search input'), 'zzzzzz')
      expect(drawer.textContent).toContain('No match for “zzzzzz”')
      expect(drawer.textContent).not.toContain('Did you mean')
      await click(button(drawer, 'Create food'))
      expect(go).toHaveBeenCalledWith('/food/my-foods/foods/new', { state: { prefill: { name: 'zzzzzz' } } })
      expect(useUI.getState().sheets).toHaveLength(0)
    })

    it('Did you mean searches the corrected words', async () => {
      const drawer = await open()
      await typeInto(drawer.querySelector('.g-lf-search input'), 'rolled oatz')
      await click(button(drawer, 'Did you mean rolled oats'))
      expect(drawer.querySelector('.g-lf-search input').value).toBe('rolled oats')
      expect(rows(drawer)).toContain('Rolled oats')
    })

    it('Add calories only is Quick calories, which logs to the diary and not to My foods', async () => {
      const drawer = await open()
      await typeInto(drawer.querySelector('.g-lf-search input'), 'zzzzzz')
      await click(button(drawer, 'Add calories only'))
      expect(top().querySelector('h2').textContent).toBe('Quick calories')
      expect(top().textContent).toContain('stays out of My foods')
      await typeInto(field(top(), 'kcal'), '300')
      await click(button(top(), 'Add to Lunch'))
      expect(nt.state.days[TODAY].items.at(-1)).toMatchObject({ meal: 1, nutrition: { calories: 300 } })
      expect(nt.state.foods).toHaveLength(fixtureFoods().length)
    })

    it('Scan its barcode opens the scanner', async () => {
      const drawer = await open()
      await typeInto(drawer.querySelector('.g-lf-search input'), 'zzzzzz')
      await click(button(drawer, 'Scan its barcode'))
      expect(useUI.getState().sheets).toHaveLength(2)
    })
  })

  it('offline, your foods and saved meals still search, the online section says it needs a connection, and a log is refused with the reason', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const drawer = await open()
    await typeInto(drawer.querySelector('.g-lf-search input'), 'oats')
    await settle(300)
    expect(drawer.textContent).toContain('Online results need a connection. Your foods and recents still work.')
    expect(rows(drawer)).toEqual(expect.arrayContaining(['Rolled oats', 'Oats and bread']))
    nt.failNext('PUT', '/nt/api/diary/', 'offline')
    await click(row(drawer, 'Rolled oats'))
    expect(useUI.getState().toastMsg).toBe('Not saved: no connection. Try again when you are back online.')
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})
