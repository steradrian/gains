// @vitest-environment happy-dom
// The food editor against the foundation's fake of NutriTrace (boards Ea5Food, Ea5Deleted): it
// saves as you type (one debounced write per burst, "Saved"), a new food is created on its first
// name and not before, Back keeps what was typed, an invalid number is never sent, and Delete takes
// the food off My foods with an Undo that brings back the very record, sending the delete only once
// the Undo can no longer be taken. Re-homes the create, edit and delete tests of the old Foods page.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { todayISO } from '../../lib/format.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useHubSync } from '../../lib/nutrition/sync.js'
import { createFakeNutriTrace, fixtureDay, fixtureFoods, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'

const nav = vi.hoisted(() => ({ leaveTo: vi.fn() }))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), leaveTo: nav.leaveTo }))

const { default: FoodEditor } = await import('./FoodEditor.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// gains-hub isFoodEdit: the keys PUT /api/foods/:id lets through.
const HUB_FOOD_EDIT = ['name', 'brand', 'barcode', 'portion', 'unit', 'category', 'notes', 'favorite', 'nutrition']
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
const buttonSaying = text => [...page.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim().startsWith(text))
const fieldNear = label => [...page.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)?.querySelector('input,textarea')
const puts = () => nt.writes().filter(w => w.method === 'PUT')
const posts = () => nt.writes().filter(w => w.method === 'POST')
const where = () => page.querySelector('[data-where]').textContent
const savedText = () => page.querySelector('.g-savedbar')?.textContent || ''

function Where() {
  const loc = useLocation()
  return <i data-where="">{loc.pathname}</i>
}

async function openEditor(url, { state, foods, settings = {}, days } = {}) {
  nt = createFakeNutriTrace({ settings: { ...fixtureSettings(), foodCategories: ['Pantry', 'Bakery', { name: 'Dairy' }], ...settings }, ...(foods ? { foods } : {}), ...(days ? { days } : {}) })
  vi.stubGlobal('fetch', nt.fetch)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(
    <MemoryRouter initialEntries={[{ pathname: url, state }]}>
      <Routes><Route path="/food/my-foods/foods/:id" element={<FoodEditor />} /></Routes>
      <Where />
    </MemoryRouter>,
  ))
  page = host
  await settle(() => expect(fieldNear('Name')).toBeTruthy())
}

beforeEach(() => {
  nav.leaveTo.mockClear()
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useHubSync.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => {
  mounted.forEach(r => { try { act(() => r.unmount()) } catch { /* already unmounted */ } })
  mounted.length = 0
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const bread = () => ({ ...fixtureFoods()[1], category: 'Bakery', favorite: 1 })

describe('a saved food', () => {
  it('shows Saved and "Changes save as you type.", its fields, and no Save button', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    expect(savedText()).toContain('Saved')
    expect(page.textContent).toContain('Changes save as you type.')
    expect(fieldNear('Name').value).toBe('Wholemeal bread')
    expect(fieldNear('Brand').value).toBe('Baker')
    expect(fieldNear('Calories').value).toBe('247')
    expect(page.textContent).toContain('Per serving, 100 g')
    expect(buttonSaying('Save')).toBeUndefined()
    expect(buttonSaying('Delete food')).toBeTruthy()
  })

  it('writes once per burst of typing, after the pause, and says Saved', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    type(fieldNear('Calories'), '2')
    type(fieldNear('Calories'), '25')
    type(fieldNear('Calories'), '250')
    expect(puts()).toHaveLength(0)
    await settle(() => expect(puts()).toHaveLength(1))
    await pause(700)
    expect(puts()).toHaveLength(1)
    const put = puts()[0]
    expect(put.path).toBe('/nt/api/foods/12')
    expect(put.body).toMatchObject({ name: 'Wholemeal bread', nutrition: { calories: 250, proteins: 13 } })
    for (const k of ['img_url', 'imgUrl', 'visibility', 'id']) expect(put.body).not.toHaveProperty(k)
    expect(Object.keys(put.body).every(k => HUB_FOOD_EDIT.includes(k))).toBe(true)
    await settle(() => expect(savedText()).toContain('Saved'))
  })

  it('keeps a food\'s whole nutrition when only Favorite is changed', async () => {
    const full = { calories: 112.5, kilojoules: 470, 'omega-3': 0.3, 'saturated-fat': 0.004, proteins: 2.5 }
    await openEditor('/food/my-foods/foods/12', { foods: [{ ...bread(), nutrition: { ...full } }] })
    tap(page.querySelector('[role=switch]'))
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.favorite).toBe(false)
    expect(puts()[0].body).not.toHaveProperty('nutrition')
    expect(nt.state.foods.find(f => f.id === 12).nutrition).toEqual(full)
  })

  it('edits energy in kJ for a kJ user and stores kcal', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()], settings: { energyUnit: 'kJ' } })
    const field = fieldNear('Calories')
    expect(field.value).toBe('1033.45')
    expect(field.closest('.g-tfield').textContent).toContain('kJ')
    type(field, '1046')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.nutrition.calories).toBe(250)
  })

  it('never sends a number that is not one: it says which field, and sends once it is fixed', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    type(fieldNear('Calories'), 'lots')
    await settle(() => expect(page.querySelector('[role=alert]').textContent).toBe('Calories must be a number, 0 or more.'))
    await pause(600)
    expect(puts()).toHaveLength(0)
    type(fieldNear('Calories'), '250')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(page.querySelector('[role=alert]')).toBeNull()
  })

  it('does not save a serving of nothing, or a food with its name cleared', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    type(fieldNear('Serving'), '0')
    await settle(() => expect(page.querySelector('[role=alert]').textContent).toBe('The serving needs an amount above 0.'))
    type(fieldNear('Serving'), '100')
    type(fieldNear('Name'), '')
    await settle(() => expect(page.querySelector('[role=alert]').textContent).toBe('Give the food a name.'))
    await pause(600)
    expect(puts()).toHaveLength(0)
  })

  it('says Not saved with a Retry when the write fails, keeps what was typed, and Retry sends it', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    nt.failNext('PUT', '/nt/api/foods/12', { status: 400, error: 'request body refused' })
    type(fieldNear('Calories'), '250')
    await settle(() => expect(savedText()).toContain('Not saved'))
    expect(useUI.getState().toastMsg).toBe('The food was not saved. Try again.')
    expect(fieldNear('Calories').value).toBe('250')
    tap(page.querySelector('.g-saved-error'))
    await settle(() => expect(savedText()).toContain('Saved'))
    expect(puts()).toHaveLength(2)
    expect(nt.state.foods.find(f => f.id === 12).nutrition.calories).toBe(250)
  })

  it('Back keeps the edit: leaving before the pause sends it, and nothing asks first', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    type(fieldNear('Name'), 'Seeded bread')
    const root = mounted.pop()
    act(() => root.unmount())
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.name).toBe('Seeded bread')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('Category opens a list of the categories, and Unit name a list of the units', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread()] })
    expect(page.textContent).toContain('Bakery')
    tap(buttonSaying('Category'))
    expect(useUI.getState().sheets).toHaveLength(1)
    useUI.getState().closeAll()
    tap(buttonSaying('Unit name'))
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})

describe('a new food', () => {
  it('writes nothing until it has a name, then creates it once and takes the real id without losing the field', async () => {
    await openEditor('/food/my-foods/foods/new')
    expect(buttonSaying('Delete food')).toBeUndefined()
    expect(savedText()).not.toContain('Saved')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)

    type(fieldNear('Calories'), '63')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)

    const name = fieldNear('Name')
    type(name, 'Skyr')
    await settle(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].path).toBe('/nt/api/foods')
    expect(posts()[0].body).toMatchObject({ name: 'Skyr', portion: 100, unit: 'g', visibility: 'private', nutrition: { calories: 63 } })
    expect(posts()[0].body).not.toHaveProperty('img_url')
    expect(typeof posts()[0].body.client_key).toBe('string')
    const id = nt.state.foods.find(f => f.name === 'Skyr').id
    await settle(() => expect(where()).toBe('/food/my-foods/foods/' + id))
    expect(fieldNear('Name')).toBe(name)
    expect(document.body.contains(name)).toBe(true)
    await settle(() => expect(buttonSaying('Delete food')).toBeTruthy())

    type(name, 'Skyr natur')
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].path).toBe('/nt/api/foods/' + id)
    expect(posts()).toHaveLength(1)
  })

  it('a favourite switched on first is sent once the food exists', async () => {
    await openEditor('/food/my-foods/foods/new')
    tap(page.querySelector('[role=switch]'))
    type(fieldNear('Name'), 'Skyr')
    await settle(() => expect(posts()).toHaveLength(1))
    await settle(() => expect(puts()).toHaveLength(1))
    expect(puts()[0].body.favorite).toBe(true)
    expect(nt.state.foods.find(f => f.name === 'Skyr').favorite).toBeTruthy()
  })

  it('a prefill fills the fields and writes nothing by itself; the first edit creates it with the barcode', async () => {
    await openEditor('/food/my-foods/foods/new', { state: { prefill: { name: 'Zucchini', barcode: '9999999999999', nutrition: { calories: 17, proteins: 1.2 } } } })
    expect(fieldNear('Name').value).toBe('Zucchini')
    expect(fieldNear('Barcode').value).toBe('9999999999999')
    expect(fieldNear('Calories').value).toBe('17')
    await pause(700)
    expect(nt.writes()).toHaveLength(0)
    type(fieldNear('Brand'), 'Farm')
    await settle(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({ name: 'Zucchini', brand: 'Farm', barcode: '9999999999999', nutrition: { calories: 17, proteins: 1.2 } })
  })

  it('keeps what was typed when the answer to the create is lost, and a retry makes one food', async () => {
    await openEditor('/food/my-foods/foods/new')
    nt.failNext('POST', '/nt/api/foods', { lost: true })
    type(fieldNear('Name'), 'Skyr')
    await settle(() => expect(savedText()).toContain('Not saved'))
    expect(fieldNear('Name').value).toBe('Skyr')
    tap(page.querySelector('.g-saved-error'))
    await settle(() => expect(savedText()).toContain('Saved'))
    expect(posts()).toHaveLength(2)
    expect(posts()[1].body.client_key).toBe(posts()[0].body.client_key)
    expect(nt.state.foods.filter(f => f.name === 'Skyr')).toHaveLength(1)
  })
})

describe('Delete food', () => {
  const day = () => fixtureDay(TODAY)

  async function openAndDelete() {
    await openEditor('/food/my-foods/foods/12', { foods: [bread(), fixtureFoods()[0]], days: { [TODAY]: day() } })
    await settle(() => expect(useNutrition.getState().foods.list).toHaveLength(2))
    tap(buttonSaying('Delete food'))
    await settle(() => expect(nav.leaveTo).toHaveBeenCalled())
  }

  it('takes the food off My foods at once, goes back to the list and offers Undo; the delete waits', async () => {
    await openAndDelete()
    expect(nav.leaveTo).toHaveBeenCalledWith('/food/my-foods?tab=foods')
    expect(useNutrition.getState().foods.list.map(f => f.id)).toEqual([11])
    expect(useUI.getState().toastMsg).toBe('Deleted Wholemeal bread from My foods')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(useUI.getState().toastAction.ms).toBe(8000)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('Undo brings back the very food, with its id, favourite and category, and nothing is ever deleted', async () => {
    await openAndDelete()
    const before = bread()
    act(() => useUI.getState().runToastAction())
    const back = useNutrition.getState().foods.list.find(f => f.id === 12)
    expect(back).toMatchObject({ id: 12, name: before.name, favorite: 1, category: 'Bakery' })
    // A reload of the list does not undo anything either.
    await act(() => useNutrition.getState().loadFoods({ force: true }))
    expect(useNutrition.getState().foods.list.map(f => f.id).sort()).toEqual([11, 12])
    await pause(100)
    expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(0)
  })

  it('Delete waits for a save that is still out: the food stays off the list and Undo brings back the saved version', async () => {
    await openEditor('/food/my-foods/foods/12', { foods: [bread(), fixtureFoods()[0]], days: { [TODAY]: day() } })
    await settle(() => expect(useNutrition.getState().foods.list).toHaveLength(2))
    const slow = nt.hold('PUT', '/nt/api/foods/12')
    type(fieldNear('Name'), 'Seeded bread')
    await pause(500)
    await settle(() => expect(puts()).toHaveLength(1))
    tap(buttonSaying('Delete food'))
    await pause(50)
    expect(nav.leaveTo).not.toHaveBeenCalled()
    slow.release()
    await settle(() => expect(nav.leaveTo).toHaveBeenCalled())
    await pause(50)
    expect(useNutrition.getState().foods.list.map(f => f.id)).toEqual([11])
    expect(useUI.getState().toastMsg).toBe('Deleted Seeded bread from My foods')
    act(() => useUI.getState().runToastAction())
    expect(useNutrition.getState().foods.list.find(f => f.id === 12)?.name).toBe('Seeded bread')
  })

  it('sends the delete once the Undo is gone, and the entries already logged keep their numbers', async () => {
    await openAndDelete()
    const items = JSON.stringify(nt.state.days[TODAY].items)
    // The list reloaded while the Undo is open must not bring the food back.
    await act(() => useNutrition.getState().loadFoods({ force: true }))
    expect(useNutrition.getState().foods.list.map(f => f.id)).toEqual([11])
    act(() => useUI.getState().toast('Something else'))
    await settle(() => expect(nt.writes().filter(w => w.method === 'DELETE')).toHaveLength(1))
    expect(nt.writes().find(w => w.method === 'DELETE').path).toBe('/nt/api/foods/12')
    expect(nt.state.foods.some(f => f.id === 12 && !f.deleted_at)).toBe(false)
    expect(JSON.stringify(nt.state.days[TODAY].items)).toBe(items)
    expect(useNutrition.getState().foods.list.map(f => f.id)).toEqual([11])
  })

  it('puts the food back and says so when the delete fails', async () => {
    await openAndDelete()
    nt.failNext('DELETE', '/nt/api/foods/12', 'offline')
    act(() => useUI.getState().toast('Something else'))
    await settle(() => expect(useUI.getState().toastMsg).toContain('Not saved: no connection.'))
    expect(useNutrition.getState().foods.list.map(f => f.id).sort()).toEqual([11, 12])
    expect(nt.state.foods.some(f => f.id === 12)).toBe(true)
  })
})
