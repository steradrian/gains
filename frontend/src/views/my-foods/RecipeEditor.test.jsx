// @vitest-environment happy-dom
// The recipe editor against the foundation's fake of NutriTrace (boards Ea5Recipe, Ea5Ingredient,
// Ea5RecipeDeleted): Makes following the ingredients until a weight is typed, Servings and One
// serving in step, each serving's numbers, saving as you type, a new recipe created once it has a
// name and an ingredient, the steps and their order (kept on the device), and Delete with an Undo
// that brings back the very recipe with its steps. The ingredient drawer is replaced by a spy; its
// own behaviour is in IngredientDrawer.test.jsx.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { todayISO } from '../../lib/format.js'
import { extrasOf, holdExtrasInMemory, saveExtras } from '../../lib/nutrition/recipe-extras.js'
import { useDiarySelection } from '../../lib/nutrition/selection.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useHubSync } from '../../lib/nutrition/sync.js'
import { createFakeNutriTrace, fixtureDay, fixtureMeals, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'
import { ingredientOf } from '../../lib/nutrition/meals.js'

const nav = vi.hoisted(() => ({ leaveTo: vi.fn(), switchTab: vi.fn() }))
const sheet = vi.hoisted(() => ({ ingredientDrawer: vi.fn() }))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), leaveTo: nav.leaveTo, switchTab: nav.switchTab }))
vi.mock('../../components/IngredientDrawer.jsx', () => ({ ingredientDrawer: sheet.ingredientDrawer }))

const { default: RecipeEditor } = await import('./RecipeEditor.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()

let nt
let page
let restoreExtras
const mounted = []

const settle = async check => {
  const end = Date.now() + 3000
  for (;;) {
    try { check(); return } catch (e) {
      if (Date.now() > end) throw e
      await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    }
  }
}
const pause = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const type = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const buttonSaying = text => [...page.querySelectorAll('button, a')].find(b => (b.getAttribute('aria-label') || b.textContent).trim().startsWith(text))
const fieldNear = label => [...page.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)?.querySelector('input,textarea')
const steps = () => [...page.querySelectorAll('textarea.g-rec-text')]
const puts = () => nt.writes().filter(w => w.method === 'PUT' && w.path.startsWith('/nt/api/meals/'))
const posts = () => nt.writes().filter(w => w.method === 'POST' && w.path === '/nt/api/meals')
const where = () => page.querySelector('[data-where]').textContent
// The list rows of the page, the photo's "Add a photo" row apart.
const listRows = () => [...page.querySelectorAll('.g-glist-row')].filter(r => !r.closest('.g-rec-photo'))
const rows = () => listRows().map(r => r.textContent)

function Where() {
  const loc = useLocation()
  return <i data-where="">{loc.pathname}</i>
}

async function openEditor(url, { state, settings = {}, meals, days } = {}) {
  nt = createFakeNutriTrace({
    settings: { ...fixtureSettings(), ...settings },
    ...(meals ? { meals } : null), ...(days ? { days } : null),
  })
  vi.stubGlobal('fetch', nt.fetch)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(
    <MemoryRouter initialEntries={[{ pathname: url, state }]}>
      <Routes><Route path="/food/my-foods/recipes/:id" element={<RecipeEditor />} /></Routes>
      <Where />
    </MemoryRouter>,
  ))
  page = host
  await settle(() => expect(fieldNear('Name')).toBeTruthy())
}

beforeEach(() => {
  nav.leaveTo.mockClear()
  nav.switchTab.mockClear()
  sheet.ingredientDrawer.mockClear()
  restoreExtras = holdExtrasInMemory()
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useHubSync.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => {
  mounted.forEach(r => { try { act(() => r.unmount()) } catch { /* already unmounted */ } })
  mounted.length = 0
  document.body.innerHTML = ''
  restoreExtras()
  vi.unstubAllGlobals()
})

// Lentil soup: 400 g of lentils and 800 g of stock make 1200 g in 4 servings of 300 g.
const recipes = () => fixtureMeals().filter(m => m.is_recipe)
const banana = () => ingredientOf({ id: 14, name: 'Banana', brand: '', portion: 120, unit: 'g', nutrition: { calories: 105, proteins: 1.3, carbohydrates: 27, fat: 0.4 } }, 120, 'g')

describe('a recipe', () => {
  it('shows its servings, one serving and what it makes, with each serving\'s numbers', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    expect(fieldNear('Name').value).toBe('Lentil soup')
    expect(fieldNear('Servings').value).toBe('4')
    expect(fieldNear('One serving').value).toBe('300')
    expect(fieldNear('Makes').value).toBe('1200')
    expect(page.textContent).toContain('Makes follows the ingredients, 1200 g, until you type the cooked weight.')
    expect(page.textContent).toContain('Per serving, 300 g')
    expect(rows().join('|')).toContain('Calories210 kcal')
    expect(rows().join('|')).toContain('Protein12 g')
    expect(rows().join('|')).toContain('Fat4 g')
    expect(page.textContent).toContain('Change what it makes after cooking and every serving updates.')
    expect(rows()[0]).toContain('Red lentils')
    expect(rows()[0]).toContain('400 g')
    expect(buttonSaying('Save')).toBeUndefined()
  })

  it('has no per-serving figure while Servings is 0 or empty', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Servings'), '0')
    expect(page.textContent).not.toContain('Per serving, ')
    expect(rows().join('|')).not.toContain('Calories')
    expect(page.textContent).toContain('Set how many servings it makes to see each one.')
    expect(fieldNear('One serving').value).toBe('')
    type(fieldNear('Servings'), '2')
    expect(rows().join('|')).toContain('Calories420 kcal')
  })

  it('typing Makes keeps it, redraws One serving, and saves the new weight per serving', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Makes'), '1000')
    expect(fieldNear('One serving').value).toBe('250')
    expect(page.textContent).toContain('Makes is the weight you typed.')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].path).toBe('/nt/api/meals/22')
    expect(puts()[0].body).toEqual({ portion: 250 })
  })

  it('changing Servings redraws One serving from Makes, and saves the servings with rescaled numbers', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Servings'), '6')
    expect(fieldNear('One serving').value).toBe('200')
    expect(fieldNear('Makes').value).toBe('1200')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body).toMatchObject({ servings: 6, portion: 200 })
    expect(puts()[0].body.nutrition.calories).toBeCloseTo(140)
  })

  it('changing One serving redraws Servings from Makes', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('One serving'), '150')
    expect(fieldNear('Servings').value).toBe('8')
    expect(fieldNear('One serving').value).toBe('150')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.servings).toBe(8)
  })

  it('an ingredient changed in the drawer moves Makes and the numbers, and saves them with the ingredients', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    tap(listRows()[0])
    const { item, index, onChange } = sheet.ingredientDrawer.mock.lastCall[0]
    expect(item.name).toBe('Red lentils')
    expect(index).toBe(0)
    act(() => onChange(index, { ...item, portion: 200, nutrition: { ...item.nutrition, calories: 300 } }))
    expect(fieldNear('Makes').value).toBe('1000')
    expect(fieldNear('One serving').value).toBe('250')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.items[0]).toMatchObject({ name: 'Red lentils', portion: 200 })
    expect(puts()[0].body).toMatchObject({ portion: 250 })
    expect(puts()[0].body.nutrition.calories).toBe(135)
  })

  it('a typed Makes stays when an ingredient changes', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Makes'), '1000')
    tap(listRows()[0])
    const { item, index, onChange } = sheet.ingredientDrawer.mock.lastCall[0]
    act(() => onChange(index, { ...item, portion: 200, nutrition: { ...item.nutrition, calories: 300 } }))
    expect(fieldNear('Makes').value).toBe('1000')
    await settle(() => expect(puts().length).toBeGreaterThan(0))
    await pause(700)
    expect(puts().at(-1).body.portion).toBe(250)
  })

  it('clearing Makes follows the ingredients again', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Makes'), '1000')
    type(fieldNear('Makes'), '')
    expect(fieldNear('Makes').value).toBe('1200')
    expect(page.textContent).toContain('Makes follows the ingredients, 1200 g')
  })

  it('takes an ingredient out with an Undo that puts it back where it was, at its amount', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    tap(listRows()[0])
    const { index, onRemove } = sheet.ingredientDrawer.mock.lastCall[0]
    act(() => onRemove(index))
    expect(useUI.getState().toastMsg).toBe('Removed Red lentils')
    expect(fieldNear('Makes').value).toBe('800')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.items.map(i => i.name)).toEqual(['Vegetable stock'])
    act(() => useUI.getState().runToastAction())
    expect(fieldNear('Makes').value).toBe('1200')
    await settle(() => expect(puts()).toHaveLength(2))
    expect(puts()[1].body.items.map(i => i.name)).toEqual(['Red lentils', 'Vegetable stock'])
    expect(puts()[1].body.items[0].portion).toBe(400)
  })

  it('does not save a recipe with no ingredients: it says so and keeps the ones it had', async () => {
    const one = { ...recipes()[0], items: [recipes()[0].items[0]] }
    await openEditor('/food/my-foods/recipes/22', { meals: [one] })
    tap(listRows()[0])
    const { index, onRemove } = sheet.ingredientDrawer.mock.lastCall[0]
    act(() => onRemove(index))
    await settle(() => expect(page.querySelector('[role=alert]').textContent).toBe('Add at least one ingredient.'))
    await pause(600)
    expect(puts()).toHaveLength(0)
    expect(nt.state.meals.find(m => m.id === 22).items).toHaveLength(1)
  })

  it('Back keeps the edit: leaving before the pause sends it', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    type(fieldNear('Name'), 'Red lentil soup')
    act(() => mounted.pop().unmount())
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body).toEqual({ name: 'Red lentil soup' })
  })

  it('says so when the recipe is not there', async () => {
    nt = createFakeNutriTrace({ settings: fixtureSettings(), meals: recipes() })
    vi.stubGlobal('fetch', nt.fetch)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    mounted.push(root)
    page = host
    act(() => root.render(
      <MemoryRouter initialEntries={['/food/my-foods/recipes/999']}>
        <Routes><Route path="/food/my-foods/recipes/:id" element={<RecipeEditor />} /></Routes>
      </MemoryRouter>,
    ))
    await settle(() => expect(page.textContent).toContain('This recipe is not in My foods'))
  })
})

describe('the steps', () => {
  it('opens with the steps kept on the device, numbered', async () => {
    saveExtras(22, { steps: [{ id: 'a', text: 'Rinse the lentils.' }, { id: 'b', text: 'Simmer for 25 minutes.' }] })
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    expect(steps().map(s => s.value)).toEqual(['Rinse the lentils.', 'Simmer for 25 minutes.'])
    expect(steps()[1].getAttribute('aria-label')).toBe('Step 2')
    expect(page.textContent).toContain('Hold and drag to reorder. Steps show when you log or cook it.')
  })

  it('adds a step, writes in it, and keeps it on the device without a save to the hub', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    expect(steps()).toHaveLength(0)
    tap(buttonSaying('Add step'))
    expect(steps()).toHaveLength(1)
    type(steps()[0], 'Rinse the lentils.')
    expect(extrasOf(22).steps.map(s => s.text)).toEqual(['Rinse the lentils.'])
    await pause(700)
    expect(nt.writes()).toHaveLength(0)
  })

  it('moves a step with its arrows, and keeps the new order', async () => {
    saveExtras(22, { steps: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }, { id: 'c', text: 'Three' }] })
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    tap(buttonSaying('Move step 1 down'))
    expect(steps().map(s => s.value)).toEqual(['Two', 'One', 'Three'])
    tap(buttonSaying('Move step 3 up'))
    expect(steps().map(s => s.value)).toEqual(['Two', 'Three', 'One'])
    expect(extrasOf(22).steps.map(s => s.text)).toEqual(['Two', 'Three', 'One'])
    expect(buttonSaying('Move step 1 up').disabled).toBe(true)
    expect(buttonSaying('Move step 3 down').disabled).toBe(true)
  })

  it('removes a step with an Undo that puts it back in its place', async () => {
    saveExtras(22, { steps: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }, { id: 'c', text: 'Three' }] })
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    tap(buttonSaying('Remove step 2'))
    expect(steps().map(s => s.value)).toEqual(['One', 'Three'])
    expect(useUI.getState().toastMsg).toBe('Removed Step 2')
    act(() => useUI.getState().runToastAction())
    expect(steps().map(s => s.value)).toEqual(['One', 'Two', 'Three'])
  })

  it('drops a blank step without a toast, and does not keep it', async () => {
    await openEditor('/food/my-foods/recipes/22', { meals: recipes() })
    tap(buttonSaying('Add step'))
    expect(extrasOf(22)).toBeNull()
    tap(buttonSaying('Remove step 1'))
    expect(steps()).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('')
  })
})

describe('a new recipe', () => {
  it('writes nothing for a name alone, and creates the recipe once it has an ingredient, taking its real id and its steps', async () => {
    await openEditor('/food/my-foods/recipes/new', { meals: [] })
    expect(buttonSaying('Delete recipe')).toBeUndefined()
    type(fieldNear('Name'), 'Banana bowl')
    tap(buttonSaying('Add step'))
    type(steps()[0], 'Slice the banana.')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)

    tap(buttonSaying('Add ingredient'))
    let at
    act(() => { at = sheet.ingredientDrawer.mock.lastCall[0].onAdd(banana()) })
    expect(at).toBe(0)
    await settle(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({ name: 'Banana bowl', is_recipe: true, servings: 1, portion: 120, unit: 'g', visibility: 'private', nutrition: { calories: 105 } })
    expect(typeof posts()[0].body.client_key).toBe('string')
    const id = nt.state.meals.find(m => m.name === 'Banana bowl').id
    await settle(() => expect(where()).toBe('/food/my-foods/recipes/' + id))
    await settle(() => expect(buttonSaying('Delete recipe')).toBeTruthy())
    expect(extrasOf(id).steps.map(s => s.text)).toEqual(['Slice the banana.'])
    type(fieldNear('Name'), 'Banana bowl, big')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(posts()).toHaveLength(1)
  })

  it('starts from a prefill without writing until it is edited', async () => {
    await openEditor('/food/my-foods/recipes/new', { meals: [], state: { prefill: { name: 'Oats', items: [banana()], servings: 2 } } })
    expect(fieldNear('Name').value).toBe('Oats')
    expect(fieldNear('Servings').value).toBe('2')
    expect(fieldNear('Makes').value).toBe('120')
    expect(fieldNear('One serving').value).toBe('60')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)
    type(fieldNear('Name'), 'Oats and banana')
    await settle(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({ name: 'Oats and banana', servings: 2, portion: 60 })
  })

  it('an untouched editor writes nothing', async () => {
    await openEditor('/food/my-foods/recipes/new', { meals: [] })
    await pause(700)
    expect(nt.writes()).toHaveLength(0)
  })
})

describe('Delete recipe', () => {
  async function openAndDelete() {
    saveExtras(22, { steps: [{ id: 'a', text: 'Rinse the lentils.' }] })
    await openEditor('/food/my-foods/recipes/22', { meals: recipes(), days: { [TODAY]: fixtureDay(TODAY) } })
    await settle(() => expect(buttonSaying('Delete recipe')).toBeTruthy())
    tap(buttonSaying('Delete recipe'))
    await settle(() => expect(nav.leaveTo).toHaveBeenCalled())
  }

  it('takes the recipe off Recipes, goes back to the list and offers Undo for 8 s; the delete waits', async () => {
    await openAndDelete()
    expect(nav.leaveTo).toHaveBeenCalledWith('/food/my-foods?tab=recipes')
    expect(useNutrition.getState().recipes.list.map(m => m.id)).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Deleted Lentil soup. Days you logged it stay')
    expect(useUI.getState().toastAction.ms).toBe(8000)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('Undo brings back the very recipe, with its steps, and nothing is ever deleted', async () => {
    await openAndDelete()
    act(() => useUI.getState().runToastAction())
    expect(useNutrition.getState().recipes.list.find(m => m.id === 22)).toMatchObject({ id: 22, name: 'Lentil soup', servings: 4 })
    expect(extrasOf(22).steps.map(s => s.text)).toEqual(['Rinse the lentils.'])
    await pause(100)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('sends the delete once the Undo is gone, and the steps go with it; the entries already logged stay', async () => {
    await openAndDelete()
    const items = JSON.stringify(nt.state.days[TODAY].items)
    expect(extrasOf(22)).not.toBeNull()
    act(() => useUI.getState().toast('Something else'))
    await settle(() => expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(1))
    expect(nt.writes().find(w => w.method === 'DELETE').path).toBe('/nt/api/meals/22')
    await settle(() => expect(extrasOf(22)).toBeNull())
    expect(JSON.stringify(nt.state.days[TODAY].items)).toBe(items)
  })
})
