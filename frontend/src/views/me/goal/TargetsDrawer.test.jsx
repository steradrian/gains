// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import '../../../lib/recent-changes-kinds.js'
import { closeThenNav } from '../../../lib/nav.js'
import { openTargets } from './TargetsDrawer.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../../lib/nav.js', async importOriginal => ({ ...(await importOriginal()), closeThenNav: vi.fn() }))

const realToast = useUI.getState().toast
const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []

const baseSettings = () => ({
  gender: 'male', dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light',
  calorieGoalMode: 'fixed', calorieGoalFactor: 0.8, waterGoalMl: 2500,
  goals: {
    calories: { max: 2100, sharedGoal: true },
    proteins: { max: 150, sharedGoal: true },
    carbohydrates: { max: 230, sharedGoal: true },
    fat: { max: 70, sharedGoal: true },
  },
})
let server
let calls
let failOn

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }

// Renders the top surface: the drawer, or its newest sub-panel.
async function renderTop() {
  const host0 = useUI.getState().sheets.at(-1)
  const surface = host0.panels?.at(-1) || host0
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(surface.render(() => useUI.getState().closeSheet(surface.id))))
  await flush()
  const button = label => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
  const field = label => [...host.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)
  const input = label => field(label).querySelector('input')
  const press = async el => { act(() => el.click()); await flush() }
  const enter = async (label, value) => { act(() => type(input(label), value)); await flush() }
  return { host, button, field, input, press, enter }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  removeEntries()
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, toast: realToast })
  server = baseSettings()
  calls = []
  failOn = new Set()
  vi.mocked(closeThenNav).mockClear()
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-10-20', w: 81.4 }] }), user: { id: 3 } })
  useNutrition.getState().reset()
  useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
  vi.spyOn(NtApi, 'getSettings').mockImplementation(async () => clone(server))
  vi.spyOn(NtApi, 'putSetting').mockImplementation(async (key, value) => {
    calls.push([key, value])
    if (failOn.has(key)) throw Object.assign(new Error('refused'), { status: 500 })
    server[key] = clone(value)
  })
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Daily targets (Me3Targets)', () => {
  it('is a full design system drawer with the mode, five fields in the person’s units and More options last', async () => {
    openTargets()
    const { host, input } = await renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs').className).toContain('g-bs-full')
    expect(host.querySelector('h2').textContent).toBe('Daily targets')
    expect([...host.querySelectorAll('.g-seg button')].map(b => b.textContent)).toEqual(['Fixed', 'Adaptive', 'Dynamic'])
    expect(host.querySelector('.g-seg button[aria-pressed="true"]').textContent).toBe('Fixed')
    expect(host.querySelector('.mg-foot').textContent).toBe('The same calorie target every day. Dynamic needs a connected wearable.')
    expect([...host.querySelectorAll('.g-tfield')].map(f => [f.querySelector('.g-tfield-label').textContent, f.querySelector('input').value, f.querySelector('.g-tfield-unit').textContent])).toEqual([
      ['Calories', '2100', 'kcal'], ['Protein', '150', 'g'], ['Carbs', '230', 'g'], ['Fat', '70', 'g'], ['Water', '2500', 'ml'],
    ])
    expect(input('Water').value).toBe('2500')
    const rows = host.querySelectorAll('.g-drow')
    expect(rows[rows.length - 1].querySelector('b').textContent).toBe('More options')
    expect(host.querySelector('.g-bs-foot button').textContent).toBe('Save daily targets')
  })

  it('Dynamic cannot be picked without a wearable', async () => {
    openTargets()
    const { host, button, press } = await renderTop()
    await press(button('Dynamic'))
    expect(host.querySelector('.g-seg button[aria-pressed="true"]').textContent).toBe('Fixed')
    await press(button('Adaptive'))
    expect(host.querySelector('.g-seg button[aria-pressed="true"]').textContent).toBe('Adaptive')
  })

  it('Dynamic can be picked with a wearable, and its note drops the wearable line', async () => {
    server.fitbitEnabled = true
    useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
    openTargets()
    const { host, button, press } = await renderTop()
    await press(button('Dynamic'))
    expect(host.querySelector('.g-seg button[aria-pressed="true"]').textContent).toBe('Dynamic')
    expect(host.querySelector('.mg-foot').textContent).toMatch(/^Uses yesterday/)
  })

  it('saving writes what changed, closes and offers Undo', async () => {
    openTargets()
    const { enter, button, press } = await renderTop()
    await enter('Calories', '2300')
    await press(button('Save daily targets'))
    expect(calls.map(([k]) => k)).toEqual(['goals'])
    expect(server.goals.calories.max).toBe(2300)
    expect(server.goals.proteins.max).toBe(150)
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('Daily targets saved')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(server.goals.calories.max).toBe(2100)
  })

  it('saving the mode writes it', async () => {
    openTargets()
    const { button, press } = await renderTop()
    await press(button('Adaptive'))
    await press(button('Save daily targets'))
    expect(server.calorieGoalMode).toBe('adaptive')
  })

  it('saving with nothing changed just closes', async () => {
    openTargets()
    const { button, press } = await renderTop()
    await press(button('Save daily targets'))
    expect(calls).toEqual([])
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('a refused save keeps the drawer, the typed values and says why', async () => {
    failOn.add('goals')
    openTargets()
    const { host, enter, input, button, press } = await renderTop()
    await enter('Calories', '2300')
    await press(button('Save daily targets'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(host.querySelector('[role="alert"]').textContent).toBe('Not saved. Try again.')
    expect(input('Calories').value).toBe('2300')
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('a blank calorie target cannot be saved', async () => {
    openTargets()
    const { host, enter, button, press } = await renderTop()
    await enter('Calories', '')
    await press(button('Save daily targets'))
    expect(calls).toEqual([])
    expect(host.querySelector('[role="alert"]').textContent).toBe('Enter a calorie target.')
  })

  it('macros that do not add up say so and the button sets the carbs', async () => {
    openTargets()
    const { host, enter, input, button, press } = await renderTop()
    await enter('Carbs', '100')
    expect(host.querySelector('.g-ibanner').textContent).toContain('The macros add up to 1,630 kcal, the calorie target is 2,100 kcal.')
    await press(button('Set carbs to 218 g'))
    expect(input('Carbs').value).toBe('218')
    expect(host.querySelector('.g-ibanner')).toBeNull()
    await press(button('Save daily targets'))
    expect(server.goals.carbohydrates.max).toBe(218)
  })

  it('under 1,200 kcal warns and still saves', async () => {
    openTargets()
    const { host, enter, button, press } = await renderTop()
    await enter('Calories', '1100')
    expect(host.textContent).toContain('Most guidelines suggest at least 1,200 kcal.')
    await press(button('Save daily targets'))
    expect(server.goals.calories.max).toBe(1100)
  })

  it('a macro that varies by weekday is a read-only row and is left alone', async () => {
    server.goals.fat = { sharedGoal: false, days: [60, 60, 60, 60, 60, 80, 80] }
    useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
    openTargets()
    const { host, field, enter, button, press } = await renderTop()
    expect(field('Fat')).toBeUndefined()
    const row = [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b').textContent === 'Fat')
    expect(row.textContent).toContain('Varies by weekday')
    await enter('Calories', '2200')
    await press(button('Save daily targets'))
    expect(server.goals.fat.sharedGoal).toBe(false)
  })

  it('is locked while edits are unsaved, and closing asks first as a sub-panel', async () => {
    openTargets()
    const clean = await renderTop()
    expect(useUI.getState().sheets[0].locked).toBe(false)
    await clean.press(clean.button('Close'))
    expect(useUI.getState().sheets).toHaveLength(0)

    openTargets()
    const first = await renderTop()
    await first.enter('Calories', '2300')
    expect(useUI.getState().sheets[0].locked).toBe(true)
    await first.press(first.button('Close'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
    const ask = await renderTop()
    expect(ask.host.querySelector('h2').textContent).toBe('Discard changes?')
    await ask.press(ask.button('Keep editing'))
    expect(useUI.getState().sheets[0].panels).toHaveLength(0)
    expect(first.host.querySelector('input').value).toBe('2300')
  })

  it('Discard closes the drawer without writing', async () => {
    openTargets()
    const { enter, button, press } = await renderTop()
    await enter('Protein', '170')
    await press(button('Close'))
    const ask = await renderTop()
    await ask.press(ask.button('Discard'))
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(calls).toEqual([])
  })

  it('More options goes to the Goals page, asking first when there are edits', async () => {
    openTargets()
    const { host, enter, press } = await renderTop()
    const more = () => [...host.querySelectorAll('.g-drow')].find(r => r.querySelector('b').textContent === 'More options')
    await press(more())
    expect(closeThenNav).toHaveBeenCalledTimes(1)
    expect(vi.mocked(closeThenNav).mock.calls[0][1]).toBe('/food/goals')
    await enter('Protein', '170')
    await press(more())
    expect(closeThenNav).toHaveBeenCalledTimes(1)
    const ask = await renderTop()
    await ask.press(ask.button('Discard'))
    expect(closeThenNav).toHaveBeenCalledTimes(2)
  })

  it('waits for the settings, and says so when they did not load', async () => {
    useNutrition.getState().reset()
    vi.mocked(NtApi.getSettings).mockImplementation(() => new Promise(() => {}))
    openTargets()
    const pending = await renderTop()
    expect(pending.host.querySelector('.g-skel')).toBeTruthy()

    useNutrition.getState().reset()
    vi.mocked(NtApi.getSettings).mockRejectedValue(Object.assign(new Error('down'), { status: 500 }))
    useUI.setState({ sheets: [] })
    openTargets()
    const failed = await renderTop()
    expect(failed.host.textContent).toContain('Goals did not load.')
  })
})
