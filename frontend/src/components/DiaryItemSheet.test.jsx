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
import { listChanges, restoreChange } from '../lib/recent-changes.js'
import { removeEntries } from '../lib/recent-changes-store.js'
import '../lib/me/food-changes.js'
import { diaryItemSheet } from './DiaryItemSheet.jsx'
import MealRow from './MealRow.jsx'
import { bindUI } from './ui.jsx'

bindUI(useUI)

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = todayISO()
let nt, host, root

function Sheets() {
  const sheets = useUI(s => s.sheets)
  // a drawer's sub-panels are drawn as sheets of their own here
  return sheets.flatMap(s => [s, ...(s.panels || [])]).map(s => <div key={s.id} data-sheet="">{s.render(() => useUI.getState().closeSheet(s.id))}</div>)
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
// The labelled boxes of the drawer (board Ea8Entry): Amount, Servings, Time, and the Meal select.
const field = label => [...lastSheet().querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)?.querySelector('input, select') ?? null
const pickMeal = async name => {
  const select = field('Meal')
  const option = [...select.options].find(o => o.textContent === name)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, option.value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}
const closeAll = async () => { await act(async () => { useUI.getState().closeAll() }); await settle() }
const named = (scope, label) => [...scope.querySelectorAll('button, [role=button]')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const itemButton = name => [...host.querySelectorAll('button.meal-item')].find(b => b.querySelector('.tt').textContent === name)
const puts = () => nt.writes().filter(r => r.method === 'PUT')
const serverItem = uuid => nt.state.days[TODAY].items.find(i => i.uuid === uuid)
const toast = () => useUI.getState().toastMsg

beforeEach(async () => {
  removeEntries()
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
    expect(lastSheet().querySelector('.g-bs').classList.contains('g-bs-half')).toBe(true)
    expect(lastSheet().querySelector('h2').textContent).toBe('Logged food')
    expect(lastSheet().querySelector('.g-en-name').textContent).toBe('Rolled oats')
    const at = timeOf(serverItem('it-oats'))
    expect(lastSheet().querySelector('.g-en-sub').textContent).toBe(`Breakfast · logged ${at} · 228 kcal`)
    expect(field('Amount').value).toBe('60')
    expect(field('Servings').value).toBe('1')
    expect(field('Time').value).toBe(at)
    expect(field('Meal').value).toBe('0')
  })
})

describe('editing', () => {
  it('rescales the amount through the portion logic and writes over the same uuid', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(field('Amount'), '120')
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
    await typeInto(field('Servings'), '2')
    await typeInto(field('Time'), '09:30')
    await pickMeal('Lunch')
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
    await typeInto(field('Amount'), '0')
    expect(named(lastSheet(), 'Save').disabled).toBe(true)
    expect(lastSheet().textContent).toContain('Enter an amount above 0.')
  })

  it('a quick-kcal row edits its time and meal, with no amount', async () => {
    await click(itemButton('Quick Calories'))
    expect(field('Amount')).toBeNull()
    expect(field('Servings')).toBeNull()
    await typeInto(field('Time'), '13:15')
    await click(named(lastSheet(), 'Save'))
    expect(timeOf(serverItem('it-quick'))).toBe('13:15')
    expect(serverItem('it-quick').nutrition).toEqual({ calories: 450 })
  })

  it('a recipe logged split into its ingredients changes only its time and meal: no amount, servings or unit', async () => {
    const item = { ...useNutrition.getState().days[TODAY].entry.items.find(i => i.uuid === 'it-oats'), _splitItems: [{ name: 'Beans' }] }
    await act(async () => { diaryItemSheet({ date: TODAY, item }) })
    await settle()
    expect(field('Amount')).toBeNull()
    expect(field('Servings')).toBeNull()
    expect(lastSheet().querySelector('[role=group][aria-label="Unit"]')).toBeNull()
    expect(field('Time')).not.toBeNull()
    expect(field('Meal')).not.toBeNull()
  })

  it('retries the same entry after a save whose answer was lost: one write, applied once', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(field('Servings'), '3')
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
    await typeInto(field('Servings'), '2')
    nt.state.days[TODAY].items =nt.state.days[TODAY].items.filter(i => i.uuid !== 'it-oats')
    nt.state.tombstones[TODAY] = [{ kind: 'item', uuid: 'it-oats', deleted_at: new Date().toISOString() }]
    await click(named(lastSheet(), 'Save'))
    expect(puts()).toHaveLength(0)
    expect(serverItem('it-oats')).toBeUndefined()
    expect(toast()).toBe('Not saved: this entry changed elsewhere. The diary now shows its latest state.')
    expect(useNutrition.getState().days[TODAY].entry.items.some(i => i.uuid === 'it-oats')).toBe(false)
    expect(itemButton('Rolled oats')).toBeUndefined()
  })

  // The other device edited while the sheet was open, so before this edit's stamp (set at the last
  // keystroke) but after the entry was logged: the case a "newer than ours" check misses.
  it('does not revert an edit another device made while the sheet was open', async () => {
    await click(itemButton('Rolled oats'))
    await typeInto(field('Servings'), '2')
    Object.assign(serverItem('it-oats'), { quantity: 5, updatedAt: new Date(Date.now() - 5000).toISOString() })
    await click(named(lastSheet(), 'Save'))
    expect(puts()).toHaveLength(0)
    expect(serverItem('it-oats').quantity).toBe(5)
    expect(toast()).toBe('Not saved: this entry changed elsewhere. The diary now shows its latest state.')
    expect(useNutrition.getState().days[TODAY].entry.items.find(i => i.uuid === 'it-oats').quantity).toBe(5)
  })

  it('refuses a sheet reopened on a stale cached entry, then saves from the refreshed one', async () => {
    await click(itemButton('Rolled oats'))
    await closeAll()
    Object.assign(serverItem('it-oats'), { quantity: 4, updatedAt: new Date(Date.now() - 60000).toISOString() })
    await click(itemButton('Rolled oats'))
    await typeInto(field('Servings'), '2')
    await click(named(lastSheet(), 'Save'))
    expect(puts()).toHaveLength(0)
    expect(serverItem('it-oats').quantity).toBe(4)
    await click(itemButton('Rolled oats'))
    expect(field('Servings').value).toBe('4')
    await typeInto(field('Servings'), '2')
    await click(named(lastSheet(), 'Save'))
    expect(serverItem('it-oats').quantity).toBe(2)
  })

  it('keeps the fields it does not edit, and every field of the day\'s other entries', async () => {
    Object.assign(serverItem('it-oats'), { food_device: 'phone-1', x_custom: { a: 1 } })
    Object.assign(serverItem('it-quick'), { food_device: 'phone-2', x_custom: 'kept' })
    await useNutrition.getState().loadDay(TODAY, { force: true })
    await click(itemButton('Rolled oats'))
    await typeInto(field('Servings'), '2')
    await click(named(lastSheet(), 'Save'))
    expect(serverItem('it-oats')).toMatchObject({ quantity: 2, food_device: 'phone-1', x_custom: { a: 1 }, food_server_id: 11 })
    expect(serverItem('it-quick')).toMatchObject({ food_device: 'phone-2', x_custom: 'kept' })
  })
})

describe('removing', () => {
  it('removes the entry with a tombstone, and Undo puts it back under a new uuid', async () => {
    const removed = { ...serverItem('it-oats') }
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    expect(nt.state.days[TODAY].items.map(i => i.uuid)).toEqual(['it-quick'])
    expect(nt.state.tombstones[TODAY]).toEqual([expect.objectContaining({ kind: 'item', uuid: 'it-oats' })])
    expect(toast()).toBe('Removed Rolled oats from Today, Breakfast')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(itemButton('Rolled oats')).toBeUndefined()
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    const back = nt.state.days[TODAY].items.find(i => i.name === 'Rolled oats')
    expect(back.uuid).not.toBe('it-oats')
    // Everything but the id: the amount, the servings, the time and the meal come back as they were.
    expect(back).toMatchObject({ portion: 60, unit: 'g', quantity: 1, meal: 0, addedAt: removed.addedAt, nutrition: removed.nutrition })
    expect(itemButton('Rolled oats')).toBeDefined()
  })

  it('Undo puts the entry back where it was, not at the end of the day', async () => {
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    expect(nt.state.days[TODAY].items.map(i => i.name)).toEqual(['Rolled oats', 'Quick Calories'])
  })

  it('a failed Undo offers Try again, which sends the same entry and restores it once', async () => {
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    nt.failNext('PUT', '/nt/api/diary/', { lost: true, status: 504 })
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    expect(toast()).toBe('Not saved. Try again.')
    expect(useUI.getState().toastAction.label).toBe('Try again')
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    const [first, second] = puts().slice(1).map(r => r.body.items.find(i => i.name === 'Rolled oats'))
    expect(second).toEqual(first)
    expect(nt.state.days[TODAY].items.filter(i => i.name === 'Rolled oats')).toHaveLength(1)
  })

  it('keeps the sheet and says so when the remove fails', async () => {
    await click(itemButton('Rolled oats'))
    nt.failNext('PUT', '/nt/api/diary/', 'offline')
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    expect(lastSheet().querySelector('[role=alert]').textContent).toBe('Not saved: no connection. Try again when you are back online.')
    expect(serverItem('it-oats')).toBeDefined()
    expect(listChanges()).toEqual([])   // a remove that failed is not a change
  })

  it('journals the remove for Recent changes; a Restore after the toast\'s Undo finds the entry back and adds nothing', async () => {
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({ kind: 'food-delete', subject: 'Rolled oats', day: TODAY, facts: { meal: 'Breakfast', day: TODAY, kcal: 228 } })
    await act(async () => { useUI.getState().runToastAction() })
    await settle()
    expect(listChanges()).toHaveLength(1)   // the in-place Undo is not journalled either
    expect(await restoreChange(row.id)).toEqual({ ok: false, reason: 'replaced' })
    expect(nt.state.days[TODAY].items.filter(i => i.name === 'Rolled oats')).toHaveLength(1)
  })

  it('a Restore from Recent changes puts the removed entry back', async () => {
    await click(itemButton('Rolled oats'))
    await click(named(lastSheet(), 'Remove Rolled oats from Breakfast'))
    expect(await restoreChange(listChanges()[0].id)).toEqual({ ok: true, where: { day: TODAY, meal: 'Breakfast' } })
    expect(nt.state.days[TODAY].items.map(i => i.name)).toEqual(['Rolled oats', 'Quick Calories'])
  })
})
