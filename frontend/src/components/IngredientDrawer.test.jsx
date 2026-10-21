// @vitest-environment happy-dom
// The ingredient drawer (board Ea5Ingredient), used by the recipe and the saved meal editors: search
// or scan a food (yours or Open Food Facts), set its amount in g or ml, and every change goes into
// the editor as it is made. NutriTrace is faked at the fetch boundary, as in FoodSearch.test.jsx.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setNav } from '../lib/nav.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { resetOffBudget } from '../lib/nutrition/off-budget.js'
import { resetOnlineSearch } from '../lib/nutrition/use-online-search.js'
import { createFakeNutriTrace, fixtureFoods, fixtureOffProduct } from '../lib/nutrition/fake-nutritrace.js'
import { ingredientOf } from '../lib/nutrition/meals.js'
import { ingredientDrawer } from './IngredientDrawer.jsx'

const camera = { hit: null }
vi.mock('./CameraScan.jsx', () => ({
  default: ({ onFound }) => <button type="button" onClick={() => onFound(camera.hit)}>camera sees a code</button>,
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  // a drawer's sub-panels are drawn as sheets of their own here
  return sheets.flatMap(s => [s, ...(s.panels || [])]).map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
const settle = async (ms = 0) => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const mount = async () => { await act(async () => { root.render(<Sheets />) }); await settle() }
const sheetsUp = () => [...host.querySelectorAll('[data-sheet]')]
const lastSheet = () => sheetsUp().at(-1)
const buttonIn = (scope, label) => [...scope.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const click = async el => { await act(async () => { el.click() }); await settle() }
const typeInto = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const search = async (scope, value) => { await typeInto(scope.querySelector('input[type=search]'), value); await settle(260) }
const row = (scope, title) => [...scope.querySelectorAll('.g-lf-row')].find(r => r.querySelector('.g-lf-title')?.textContent === title)
const titles = scope => [...scope.querySelectorAll('.g-lf-title')].map(n => n.textContent)
const amountField = scope => [...scope.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === 'Amount')?.querySelector('input')
const foodPosts = () => nt.writes().filter(r => r.path === '/nt/api/foods')

const OATS = () => nt.state.foods.find(f => f.name === 'Rolled oats')
// Rolled oats at 60 g: 228 kcal, 8.1 g protein.
const oatsLine = () => ingredientOf(OATS(), 60, 'g')

const open = async props => {
  await mount()
  await act(async () => { ingredientDrawer(props) })
  await settle()
}

beforeEach(() => {
  nt = createFakeNutriTrace({ foods: fixtureFoods(), offProducts: { '3017620422003': fixtureOffProduct('3017620422003') } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState(s => ({
    user: { id: 3, name: 'Ana' },
    pushState: vi.fn(async () => {}),
    S: { ...s.S, routines: [], workouts: [], dayPlan: {}, week: {}, active: null, checkIn: false, unit: 'kg' },
  }))
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  resetOnlineSearch()
  resetOffBudget()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  camera.hit = null
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('an ingredient already in the recipe', () => {
  const props = () => ({ item: oatsLine(), index: 1, onAdd: vi.fn(), onChange: vi.fn(), onRemove: vi.fn() })

  it('shows the food, where it is from, its amount, and the numbers for that amount', async () => {
    await useNutrition.getState().loadFoods()
    await open(props())
    const sheet = lastSheet()
    expect(sheet.querySelector('h2').textContent).toBe('Rolled oats')
    expect(sheet.textContent).toContain('Your food · 380 kcal per 100 g')
    expect(amountField(sheet).value).toBe('60')
    expect([...sheet.querySelectorAll('.g-seg button')].map(b => b.textContent)).toEqual(['g', 'ml'])
    expect(buttonIn(sheet, 'g').getAttribute('aria-pressed')).toBe('true')
    const stats = [...sheet.querySelectorAll('.g-ing-stats div')].map(d => d.textContent)
    expect(stats).toEqual(['228 kcalCalories', '8.1 gProtein', '36 gCarbs', '4.2 gFat'])
  })

  it('puts every change of the amount into the recipe as it is typed, and nothing is confirmed', async () => {
    const p = props()
    await open(p)
    await typeInto(amountField(lastSheet()), '120')
    expect(p.onChange).toHaveBeenLastCalledWith(1, expect.objectContaining({ name: 'Rolled oats', portion: 120, unit: 'g' }))
    expect(p.onChange.mock.lastCall[1].nutrition.calories).toBeCloseTo(456)
    expect(lastSheet().textContent).toContain('456 kcal')
    expect(buttonIn(lastSheet(), 'Save')).toBeUndefined()
    expect(p.onAdd).not.toHaveBeenCalled()
  })

  it('reads a comma as the decimal mark', async () => {
    const p = props()
    await open(p)
    await typeInto(amountField(lastSheet()), '12,5')
    expect(p.onChange.mock.lastCall[1].portion).toBe(12.5)
  })

  it('sends nothing, and says why, while the amount is not above 0', async () => {
    const p = props()
    await open(p)
    await typeInto(amountField(lastSheet()), '0')
    expect(p.onChange).not.toHaveBeenCalled()
    expect(lastSheet().querySelector('[role=status]').textContent).toBe('Enter an amount above 0.')
    expect(lastSheet().querySelector('.g-ing-stats')).toBeNull()
  })

  it('changes the unit between g and ml', async () => {
    const p = props()
    await open(p)
    await click(buttonIn(lastSheet(), 'ml'))
    expect(p.onChange).toHaveBeenLastCalledWith(1, expect.objectContaining({ portion: 60, unit: 'ml' }))
    expect(buttonIn(lastSheet(), 'ml').getAttribute('aria-pressed')).toBe('true')
  })

  it('Take out removes that ingredient and closes; Done only closes', async () => {
    const p = props()
    await open(p)
    await click(buttonIn(lastSheet(), 'Take out'))
    expect(p.onRemove).toHaveBeenCalledWith(1)
    expect(useUI.getState().sheets).toHaveLength(0)

    const q = props()
    await act(async () => { ingredientDrawer(q) })
    await settle()
    await click(buttonIn(lastSheet(), 'Done'))
    expect(q.onRemove).not.toHaveBeenCalled()
    expect(q.onChange).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('Swap food goes to the search, and the food chosen replaces the ingredient in place', async () => {
    const p = props()
    await open(p)
    await click(buttonIn(lastSheet(), 'Swap food'))
    expect(lastSheet().querySelector('h2').textContent).toBe('Add ingredient')
    await search(lastSheet(), 'bread')
    await click(row(lastSheet(), 'Wholemeal bread'))
    expect(p.onAdd).not.toHaveBeenCalled()
    expect(p.onChange).toHaveBeenLastCalledWith(1, expect.objectContaining({ name: 'Wholemeal bread' }))
    expect(lastSheet().querySelector('h2').textContent).toBe('Wholemeal bread')
    expect(nt.writes()).toEqual([])
  })
})

describe('adding an ingredient', () => {
  const props = () => ({ onAdd: vi.fn(() => 3), onChange: vi.fn(), onRemove: vi.fn() })

  it('searches your foods and Open Food Facts, and shows your recent foods before anything is typed', async () => {
    await open(props())
    expect(lastSheet().querySelector('h2').textContent).toBe('Add ingredient')
    expect(titles(lastSheet())).toContain('Rolled oats')
    await search(lastSheet(), 'nutella')
    expect([...lastSheet().querySelectorAll('.g-lf-sec')].map(n => n.textContent)).toEqual(['Your foods', 'Open Food Facts'])
    expect(titles(lastSheet())).toContain('Nutella')
  })

  it('uses one of your foods without saving anything, then edits that same ingredient', async () => {
    const p = props()
    await open(p)
    await click(row(lastSheet(), 'Rolled oats'))
    expect(p.onAdd).toHaveBeenCalledTimes(1)
    expect(p.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rolled oats', unit: 'g' }))
    expect(nt.writes()).toEqual([])
    expect(lastSheet().querySelector('h2').textContent).toBe('Rolled oats')
    await typeInto(amountField(lastSheet()), '90')
    expect(p.onChange).toHaveBeenLastCalledWith(3, expect.objectContaining({ name: 'Rolled oats', portion: 90 }))
    expect(p.onAdd).toHaveBeenCalledTimes(1)
  })

  it('keeps a count with no weight in its own unit, beside g and ml, rather than reading it as grams', async () => {
    nt.state.foods.push({ ...structuredClone(OATS()), id: 300, name: 'Egg', portion: 1, unit: 'piece', nutrition: { calories: 70, proteins: 6, carbohydrates: 0, fat: 5 } })
    const p = props()
    await open(p)
    await search(lastSheet(), 'egg')
    await click(row(lastSheet(), 'Egg'))
    expect(p.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Egg', unit: 'piece', portion: 1 }))
    expect(p.onAdd.mock.lastCall[0].nutrition.calories).toBe(70)
    expect([...lastSheet().querySelectorAll('.g-seg button')].map(b => b.textContent)).toEqual(['g', 'ml', 'piece'])
  })

  it('takes a serving the food knows the weight of as grams', async () => {
    nt.state.foods.push({ ...structuredClone(OATS()), id: 301, name: 'Toast', portion: 1, unit: 'slice', alt_units: [{ abbr: 'slice', grams: 36 }], nutrition: { calories: 90, proteins: 3, carbohydrates: 16, fat: 1 } })
    const p = props()
    await open(p)
    await search(lastSheet(), 'toast')
    await click(row(lastSheet(), 'Toast'))
    expect(p.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Toast', unit: 'g', portion: 36 }))
    expect(p.onAdd.mock.lastCall[0].nutrition.calories).toBeCloseTo(90)
  })

  it('saves an online result as a food first, then uses it', async () => {
    const p = props()
    await open(p)
    await search(lastSheet(), 'nutella')
    await click(row(lastSheet(), 'Nutella'))
    expect(foodPosts()).toHaveLength(1)
    expect(foodPosts()[0].body).toMatchObject({ name: 'Nutella', barcode: '3017620422003', visibility: 'private' })
    expect(p.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nutella', id: nt.state.foods.find(f => f.name === 'Nutella').id }))
  })

  it('a save whose answer was lost, tapped again, makes one food', async () => {
    const p = props()
    nt.failNext('POST', '/nt/api/foods', { lost: true, status: 504 })
    await open(p)
    await search(lastSheet(), 'nutella')
    await click(row(lastSheet(), 'Nutella'))
    expect(lastSheet().querySelector('[role=alert]')).not.toBeNull()
    expect(p.onAdd).not.toHaveBeenCalled()
    await click(row(lastSheet(), 'Nutella'))
    expect(foodPosts()).toHaveLength(2)
    expect(foodPosts()[1].body.client_key).toBe(foodPosts()[0].body.client_key)
    expect(nt.state.foods.filter(f => f.name === 'Nutella')).toHaveLength(1)
    expect(p.onAdd).toHaveBeenCalledTimes(1)
  })

  it('holds the rows while a save is out', async () => {
    const p = props()
    await open(p)
    await search(lastSheet(), 'nutella')
    const slow = nt.hold('POST', '/nt/api/foods')
    await click(row(lastSheet(), 'Nutella'))
    expect(row(lastSheet(), 'Nutella').getAttribute('aria-disabled')).toBe('true')
    await click(row(lastSheet(), 'Nutella'))
    expect(foodPosts()).toHaveLength(1)
    await act(async () => { slow.release() })
    await settle()
    expect(p.onAdd).toHaveBeenCalledTimes(1)
  })

  it('Scan opens over the drawer as a panel of it, and a scanned product is saved first and used', async () => {
    const p = props()
    await open(p)
    await click(buttonIn(lastSheet(), 'Scan'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    camera.hit = { value: '3017620422003', fmt: 'ean13' }
    await click(buttonIn(lastSheet(), 'camera sees a code'))
    expect(buttonIn(lastSheet(), 'Quick kcal')).toBeUndefined()
    await click(buttonIn(lastSheet(), 'Use'))
    expect(foodPosts()).toHaveLength(1)
    expect(p.onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nutella' }))
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
  })

  it('lists 50 of your foods with Show more', async () => {
    for (let i = 0; i < 60; i++) nt.state.foods.push({ ...structuredClone(OATS()), id: 400 + i, name: `Food ${String(i).padStart(2, '0')}`, usage_count: 0, last_used_at: null })
    await open(props())
    await search(lastSheet(), 'food ')
    expect(titles(lastSheet()).filter(n => n.startsWith('Food '))).toHaveLength(50)
    await click(buttonIn(lastSheet(), 'Show more'))
    expect(titles(lastSheet())).toContain('Food 59')
  })

  it('offers Try again when your foods did not load', async () => {
    nt.failNext('GET', '/nt/api/foods', 'offline')
    await open(props())
    expect(lastSheet().textContent).toContain('Your foods did not load.')
    await click(buttonIn(lastSheet(), 'Try again'))
    expect(titles(lastSheet())).toContain('Rolled oats')
  })

  it('Create a food leaves for the new-food editor with the typed name, and the drawer closes', async () => {
    const go = vi.fn()
    setNav(go)
    await open(props())
    await search(lastSheet(), 'Zucchini')
    await click(buttonIn(lastSheet(), 'Create a food'))
    expect(go).toHaveBeenCalledWith('/food/my-foods/foods/new', expect.objectContaining({ state: { prefill: { name: 'Zucchini' } } }))
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('matches a product with no barcode by the key it was saved under, not by its name', async () => {
    nt.state.offSearch = { products: [{ product_name: 'Plain oats', nutriments: { 'energy-kcal_100g': 370 } }] }
    const p = props()
    await open(p)
    await search(lastSheet(), 'plain')
    await click(row(lastSheet(), 'Plain oats'))
    useNutrition.setState(s => ({ foods: { ...s.foods, list: s.foods.list.map(f => (f.name === 'Plain oats' ? { ...f, name: 'Granola' } : f)) } }))
    await click(buttonIn(lastSheet(), 'Swap food'))
    await search(lastSheet(), 'plain')
    expect(titles(lastSheet())).toContain('Granola')
    expect(titles(lastSheet())).not.toContain('Plain oats')
  })
})
