// @vitest-environment happy-dom
// Editing and removing a logged item, against NutriTrace faked at the fetch boundary (its merge by
// uuid and its tombstones): the item is a real button, the edit is one retry-safe write over the
// same uuid, and an entry removed or edited elsewhere is not written back over.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { mealItems, timeOf } from '../lib/nutrition/diary.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { createFakeNutriTrace, fixtureDay } from '../lib/nutrition/fake-nutritrace.js'
import MealRow from './MealRow.jsx'
import { bindUI } from './ui.jsx'

bindUI(useUI)

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
}
function Day() {
  const entry = useNutrition(s => s.days[TODAY]?.entry)
  return <>
    <MealRow date={TODAY} slot={0} name="Breakfast" items={mealItems(entry, 0)} />
    <MealRow date={TODAY} slot={1} name="Lunch" items={mealItems(entry, 1)} />
    <Sheets />
  </>
}
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const click = async el => { await act(async () => { el.click() }); await settle() }
const typeInto = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}
const lastSheet = () => [...host.querySelectorAll('[data-sheet]')].at(-1)
const named = (scope, label) => [...scope.querySelectorAll('button, [role=button]')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const itemButton = name => [...host.querySelectorAll('button.meal-item')].find(b => b.querySelector('.tt').textContent === name)
const puts = () => nt.writes().filter(r => r.method === 'PUT')
const serverItem = uuid => nt.state.days[TODAY].items.find(i => i.uuid === uuid)
const toast = () => useUI.getState().toastMsg

beforeEach(async () => {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY) } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await useNutrition.getState().loadSettings()
  await useNutrition.getState().loadDay(TODAY)
  await act(async () => { root.render(<Day />) })
  await settle()
  for (const toggle of host.querySelectorAll('.meal-toggle')) if (!toggle.disabled) await click(toggle)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('a logged item', () => {
  it('is a real button, 44px tall, named by what it is', () => {
    const b = itemButton('Rolled oats')
    expect(b.tagName).toBe('BUTTON')
    expect(b.getAttribute('aria-label')).toMatch(/^Edit Rolled oats, 60 g, /)
    expect(host.querySelector('li > button.meal-item')).toBe(b)
  })

  it('opens its sheet when tapped', async () => {
    await click(itemButton('Rolled oats'))
    expect(lastSheet().querySelector('h3').textContent).toBe('Rolled oats')
    expect(lastSheet().querySelector('input[aria-label="Serving size"]').value).toBe('60')
  })
})

describe('editing', () => {
  it('rescales the amount through the portion logic and writes over the same uuid', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(lastSheet().querySelector('input[aria-label="Serving size"]'), '120')
    await click(named(lastSheet(), 'Save'))
    expect(puts()).toHaveLength(1)
    const saved = serverItem('it-oats')
    expect(saved).toMatchObject({ portion: 120, unit: 'g', quantity: 1, meal: 0 })
    expect(saved.nutrition.calories).toBeCloseTo(456)
    expect(nt.state.days[TODAY].items).toHaveLength(2)
    expect(useNutrition.getState().days[TODAY].entry.items.find(i => i.uuid === 'it-oats').portion).toBe(120)
    expect(toast()).toBe('Updated')
    expect(host.querySelectorAll('[data-sheet]')).toHaveLength(0)
  })

  it('changes the servings, the time and the meal', async () => {
    const before = serverItem('it-oats')
    await click(itemButton('Rolled oats'))
    const sheet = lastSheet()
    await typeInto(sheet.querySelector('input[aria-label="Servings"]'), '2')
    await typeInto(sheet.querySelector('input[type=time]'), '09:30')
    await click([...sheet.querySelectorAll('button.lrow')].find(r => r.textContent.startsWith('Meal')))
    await click([...lastSheet().querySelectorAll('button')].find(b => b.textContent.includes('Lunch') && !b.textContent.includes('Meal')))
    await click(named(lastSheet(), 'Save'))
    const saved = serverItem('it-oats')
    expect(saved.quantity).toBe(2)
    expect(saved.meal).toBe(1)
    expect(timeOf(saved)).toBe('09:30')
    expect(saved.updatedAt > before.addedAt).toBe(true)
    expect(itemButton('Rolled oats').closest('.meal-row').querySelector('.meal-name').textContent).toBe('Lunch')
  })

  it('keeps Save off until something changes', async () => {
    await click(itemButton('Rolled oats'))
    expect(named(lastSheet(), 'Save').disabled).toBe(true)
    await typeInto(lastSheet().querySelector('input[aria-label="Serving size"]'), '0')
    expect(named(lastSheet(), 'Save').disabled).toBe(true)
    expect(lastSheet().textContent).toContain('Enter an amount above 0.')
  })

  it('a quick-kcal row edits its time and meal, with no amount', async () => {
    await click(itemButton('Quick Calories'))
    expect(lastSheet().querySelector('input[aria-label="Serving size"]')).toBeNull()
    await typeInto(lastSheet().querySelector('input[type=time]'), '13:15')
    await click(named(lastSheet(), 'Save'))
    expect(timeOf(serverItem('it-quick'))).toBe('13:15')
    expect(serverItem('it-quick').nutrition).toEqual({ calories: 450 })
  })

  it('retries the same entry after a save whose answer was lost: one write, applied once', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(lastSheet().querySelector('input[aria-label="Servings"]'), '3')
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    await click(named(lastSheet(), 'Save'))
    expect(lastSheet().querySelector('[role=alert]').textContent).toBe('Not saved. Try again.')
    await click(named(lastSheet(), 'Save'))
    const [first, second] = puts().map(r => r.body.items.find(i => i.uuid === 'it-oats'))
    expect(second).toEqual(first)
    expect(nt.state.days[TODAY].items.filter(i => i.uuid === 'it-oats')).toHaveLength(1)
    expect(serverItem('it-oats').quantity).toBe(3)
  })

  it('does not write an entry back that was removed elsewhere, and shows the day as it is', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(lastSheet().querySelector('input[aria-label="Servings"]'), '2')
    nt.state.days[TODAY].items = nt.state.days[TODAY].items.filter(i => i.uuid !== 'it-oats')
    nt.state.tombstones[TODAY] = [{ kind: 'item', uuid: 'it-oats', deleted_at: new Date().toISOString() }]
    await click(named(lastSheet(), 'Save'))
    expect(puts()).toHaveLength(0)
    expect(serverItem('it-oats')).toBeUndefined()
    expect(toast()).toBe('Not saved: this entry changed elsewhere. The diary now shows its latest state.')
    expect(useNutrition.getState().days[TODAY].entry.items.some(i => i.uuid === 'it-oats')).toBe(false)
    expect(itemButton('Rolled oats')).toBeUndefined()
  })

  it('does not overwrite a newer copy edited elsewhere', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(lastSheet().querySelector('input[aria-label="Servings"]'), '2')
    Object.assign(serverItem('it-oats'), { quantity: 5, updatedAt: '2999-01-01T00:00:00.000Z' })
    await click(named(lastSheet(), 'Save'))
    expect(serverItem('it-oats').quantity).toBe(5)
    expect(toast()).toBe('Not saved: this entry changed elsewhere. The diary now shows its latest state.')
    expect(useNutrition.getState().days[TODAY].entry.items.find(i => i.uuid === 'it-oats').quantity).toBe(5)
  })
})

describe('removing', () => {
  it('removes the entry with a tombstone, and Undo puts it back under a new uuid', async () => {
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove'))
    expect(nt.state.days[TODAY].items.map(i => i.uuid)).toEqual(['it-quick'])
    expect(nt.state.tombstones[TODAY]).toEqual([expect.objectContaining({ kind: 'item', uuid: 'it-oats' })])
    expect(toast()).toBe('Removed Rolled oats')
    expect(itemButton('Rolled oats')).toBeUndefined()
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    const back = nt.state.days[TODAY].items.find(i => i.name === 'Rolled oats')
    expect(back.uuid).not.toBe('it-oats')
    expect(back).toMatchObject({ portion: 60, unit: 'g', meal: 0 })
    expect(itemButton('Rolled oats')).toBeDefined()
  })

  it('keeps the sheet and says so when the remove fails', async () => {
    await click(itemButton('Rolled oats'))
    nt.failNext('PUT', '/nt/api/diary/', 'offline')
    await click(named(lastSheet(), 'Remove'))
    expect(lastSheet().querySelector('[role=alert]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(serverItem('it-oats')).toBeDefined()
  })
})
