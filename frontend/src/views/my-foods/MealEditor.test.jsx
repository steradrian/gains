// @vitest-environment happy-dom
// The saved meal editor against the foundation's fake of NutriTrace (boards Ea5Meal, Ea5MealDeleted):
// the foods with their amounts, the total and its share of the day's targets (only with a goal), saving
// as you type, a new meal created once it has a name and a food, Log to Today, and Delete with an Undo
// that brings back the very meal. Re-homes the saved-meal create, edit and delete tests of the old
// MealCatalog page.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { todayISO } from '../../lib/format.js'
import { useDiarySelection } from '../../lib/nutrition/selection.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useHubSync } from '../../lib/nutrition/sync.js'
import { createFakeNutriTrace, fixtureDay, fixtureMeals, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'
import { ingredientOf } from '../../lib/nutrition/meals.js'

const nav = vi.hoisted(() => ({ leaveTo: vi.fn(), switchTab: vi.fn() }))
const sheet = vi.hoisted(() => ({ ingredientDrawer: vi.fn() }))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), leaveTo: nav.leaveTo, switchTab: nav.switchTab }))
vi.mock('../../components/IngredientDrawer.jsx', () => ({ ingredientDrawer: sheet.ingredientDrawer }))

const { default: MealEditor } = await import('./MealEditor.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()

let nt
let page
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
const puts = () => nt.writes().filter(w => w.method === 'PUT' && w.path.startsWith('/nt/api/meals/'))
const posts = () => nt.writes().filter(w => w.method === 'POST' && w.path === '/nt/api/meals')
const where = () => page.querySelector('[data-where]').textContent
const rows = () => [...page.querySelectorAll('.g-glist-row')].map(r => r.textContent)

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
      <Routes><Route path="/food/my-foods/meals/:id" element={<MealEditor />} /></Routes>
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
  vi.unstubAllGlobals()
})

const savedMeals = () => fixtureMeals().filter(m => !m.is_recipe)
const banana = () => ingredientOf({ id: 14, name: 'Banana', brand: '', portion: 120, unit: 'g', nutrition: { calories: 105, proteins: 1.3, carbohydrates: 27, fat: 0.4 } }, 120, 'g')

describe('a saved meal', () => {
  it('lists its foods with amount and energy, the total, and each macro against the day\'s targets', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals() })
    expect(fieldNear('Name').value).toBe('Oats and bread')
    expect(rows()[0]).toContain('Rolled oats')
    expect(rows()[0]).toContain('60 g')
    expect(rows()[0]).toContain('228 kcal')
    expect(page.textContent).toContain('Total, 354 kcal')
    await settle(() => expect(rows().join('|')).toContain('16 of 160 g'))
    expect(rows().join('|')).toContain('55 of 165 g')
    expect(rows().join('|')).toContain('5 of 70 g')
    expect(page.textContent).toContain('The share of a day’s targets: protein 10%, carbs 33%, fat 8%.')
    expect(page.textContent).toContain('Saved')
    expect(buttonSaying('Save')).toBeUndefined()
  })

  it('leaves the targets and the share line out when no goal is set', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals(), settings: { goals: {} } })
    await settle(() => expect(page.textContent).toContain('Total, 354 kcal'))
    expect(rows().join('|')).toContain('16 g')
    expect(rows().join('|')).not.toContain(' of ')
    expect(page.textContent).not.toContain('share of a day')
  })

  it('writes a rename once, after the pause, as the name alone', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals() })
    type(fieldNear('Name'), 'Oa')
    type(fieldNear('Name'), 'Oats, bread')
    expect(puts()).toHaveLength(0)
    await settle(() => expect(puts()).toHaveLength(1))
    await pause(700)
    expect(puts()).toHaveLength(1)
    expect(puts()[0].path).toBe('/nt/api/meals/21')
    expect(puts()[0].body).toEqual({ name: 'Oats, bread' })
  })

  it('changes a food\'s amount through its drawer, and the total follows', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals() })
    tap([...page.querySelectorAll('.g-glist-row')][0])
    const { item, index, onChange } = sheet.ingredientDrawer.mock.lastCall[0]
    expect(item.name).toBe('Rolled oats')
    expect(index).toBe(0)
    act(() => onChange(index, { ...item, portion: 120, nutrition: { ...item.nutrition, calories: 456 } }))
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.items[0]).toMatchObject({ name: 'Rolled oats', portion: 120 })
    expect(puts()[0].body.nutrition.calories).toBe(582)
    expect(page.textContent).toContain('Total, 582 kcal')
  })

  it('adds a food from Add food, and takes one out with an Undo', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals() })
    tap(buttonSaying('Add food'))
    let added
    act(() => { added = sheet.ingredientDrawer.mock.lastCall[0].onAdd(banana()) })
    expect(added).toBe(2)
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.items.map(i => i.name)).toEqual(['Rolled oats', 'Wholemeal bread', 'Banana'])

    tap([...page.querySelectorAll('.g-glist-row')][2])
    const { index, onRemove } = sheet.ingredientDrawer.mock.lastCall[0]
    act(() => onRemove(index))
    expect(useUI.getState().toastMsg).toBe('Removed Banana')
    await settle(() => expect(puts()).toHaveLength(2))
    expect(puts()[1].body.items.map(i => i.name)).toEqual(['Rolled oats', 'Wholemeal bread'])
    act(() => useUI.getState().runToastAction())
    await settle(() => expect(puts()).toHaveLength(3))
    expect(puts()[2].body.items.map(i => i.name)).toEqual(['Rolled oats', 'Wholemeal bread', 'Banana'])
  })

  it('does not save a meal with no foods: it says so and keeps the foods it had', async () => {
    const one = { ...savedMeals()[0], items: [savedMeals()[0].items[0]] }
    await openEditor('/food/my-foods/meals/21', { meals: [one] })
    tap([...page.querySelectorAll('.g-glist-row')][0])
    const { index, onRemove } = sheet.ingredientDrawer.mock.lastCall[0]
    act(() => onRemove(index))
    await settle(() => expect(page.querySelector('[role=alert]').textContent).toBe('Add at least one ingredient.'))
    await pause(600)
    expect(puts()).toHaveLength(0)
    expect(nt.state.meals.find(m => m.id === 21).items).toHaveLength(1)
  })

  it('Back keeps the edit: leaving before the pause sends it', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals() })
    type(fieldNear('Name'), 'Breakfast bowl')
    act(() => mounted.pop().unmount())
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.name).toBe('Breakfast bowl')
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})

describe('a new saved meal', () => {
  it('writes nothing for a name alone, and creates the meal once it has a food, taking its real id', async () => {
    await openEditor('/food/my-foods/meals/new', { meals: [] })
    expect(buttonSaying('Delete saved meal')).toBeUndefined()
    type(fieldNear('Name'), 'Snack')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)

    tap(buttonSaying('Add food'))
    act(() => { sheet.ingredientDrawer.mock.lastCall[0].onAdd(banana()) })
    await settle(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({ name: 'Snack', is_recipe: false, visibility: 'private', nutrition: { calories: 105 } })
    expect(typeof posts()[0].body.client_key).toBe('string')
    const id = nt.state.meals.find(m => m.name === 'Snack').id
    await settle(() => expect(where()).toBe('/food/my-foods/meals/' + id))
    await settle(() => expect(buttonSaying('Delete saved meal')).toBeTruthy())
    type(fieldNear('Name'), 'Snack time')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(posts()).toHaveLength(1)
  })

  it('an untouched editor writes nothing', async () => {
    await openEditor('/food/my-foods/meals/new', { meals: [] })
    await pause(700)
    expect(nt.writes()).toHaveLength(0)
  })
})

describe('Log to Today', () => {
  it('logs every food to the current meal of today, in one write, and returns to Today with the Added toast', async () => {
    useDiarySelection.getState().setDate('2026-01-05')
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals(), days: { [TODAY]: fixtureDay(TODAY) } })
    const log = await settle(() => expect(buttonSaying('Log to Today, ')).toBeTruthy()).then(() => buttonSaying('Log to Today, '))
    tap(log)
    await settle(() => expect(nav.switchTab).toHaveBeenCalledWith('home'))
    const writes = nt.writes().filter(w => w.method === 'PUT' && w.path === `/nt/api/diary/${TODAY}`)
    expect(writes).toHaveLength(1)
    expect(writes[0].body.items.map(i => i.name)).toEqual(expect.arrayContaining(['Rolled oats', 'Wholemeal bread']))
    expect(useUI.getState().toastMsg).toMatch(/^Added Oats and bread to Today, /)
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(useDiarySelection.getState().date).toBe('2026-01-05')
  })

  it('stays on the page and says why when the write fails', async () => {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals(), days: { [TODAY]: fixtureDay(TODAY) } })
    await settle(() => expect(buttonSaying('Log to Today, ')).toBeTruthy())
    nt.failNext('PUT', '/nt/api/diary/', 'offline')
    tap(buttonSaying('Log to Today, '))
    await settle(() => expect(useUI.getState().toastMsg).toContain('Not saved: no connection.'))
    expect(nav.switchTab).not.toHaveBeenCalled()
  })
})

describe('Delete saved meal', () => {
  async function openAndDelete() {
    await openEditor('/food/my-foods/meals/21', { meals: savedMeals(), days: { [TODAY]: fixtureDay(TODAY) } })
    await settle(() => expect(buttonSaying('Delete saved meal')).toBeTruthy())
    tap(buttonSaying('Delete saved meal'))
    await settle(() => expect(nav.leaveTo).toHaveBeenCalled())
  }

  it('takes the meal off Saved meals, goes back to the list and offers Undo for 8 s; the delete waits', async () => {
    await openAndDelete()
    expect(nav.leaveTo).toHaveBeenCalledWith('/food/my-foods?tab=meals')
    expect(useNutrition.getState().meals.list.map(m => m.id)).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Deleted Oats and bread. Meals you logged with it stay')
    expect(useUI.getState().toastAction.ms).toBe(8000)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('Undo brings back the very meal and nothing is ever deleted', async () => {
    await openAndDelete()
    act(() => useUI.getState().runToastAction())
    expect(useNutrition.getState().meals.list.find(m => m.id === 21)).toMatchObject({ id: 21, name: 'Oats and bread' })
    await pause(100)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('sends the delete once the Undo is gone; the entries already logged stay', async () => {
    await openAndDelete()
    const items = JSON.stringify(nt.state.days[TODAY].items)
    act(() => useUI.getState().toast('Something else'))
    await settle(() => expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(1))
    expect(nt.writes().find(w => w.method === 'DELETE').path).toBe('/nt/api/meals/21')
    expect(JSON.stringify(nt.state.days[TODAY].items)).toBe(items)
  })
})
