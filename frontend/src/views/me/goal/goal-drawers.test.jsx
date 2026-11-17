// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useProfileWrites } from '../../../lib/me/goal-writes.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import '../../../lib/recent-changes-kinds.js'
import { bodyDetailsSheet, goalPickSheet, movementSheet, targetWeightSheet } from './goal-drawers.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const realToast = useUI.getState().toast
const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []
const S = () => useStore.getState().S

// Me3Goal's man: lose, male, 182 cm, born 1994, 81.4 kg now (85 at the start), light movement, target 78.
const baseSettings = () => ({
  gender: 'male', dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light',
  calorieGoalMode: 'fixed', calorieGoalFactor: 0.8, waterGoalMl: 2500,
  goals: {
    calories: { max: 1978, sharedGoal: true },
    proteins: { max: 163, sharedGoal: true },
    carbohydrates: { max: 208, sharedGoal: true },
    fat: { max: 55, sharedGoal: true },
  },
})
const baseState = (over = {}) => Object.assign(clone(DEF), {
  unit: 'kg', targetW: 78,
  bodyweight: [{ d: '2026-08-02', w: 85 }, { d: '2026-10-20', w: 81.4 }],
}, over)

let server
let calls
let failOn

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }

async function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  await flush()
  const button = label => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === label)
  const radio = label => [...host.querySelectorAll('[role="radio"]')].find(b => b.querySelector('b')?.textContent === label)
  const field = label => [...host.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === label)
  const press = async el => { act(() => el.click()); await flush() }
  return { host, button, radio, field, press }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  removeEntries()
  document.body.innerHTML = ''
  useProfileWrites.setState({ live: true })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, toast: realToast })
  server = baseSettings()
  calls = []
  failOn = new Set()
  useStore.setState({ S: baseState(), user: { id: 3 } })
  loaded()
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

// The settings the page had loaded before the drawer opened.
function loaded() {
  useNutrition.getState().reset()
  useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
}
const keysOf = () => calls.map(([k]) => k)
const sheetsOpen = () => useUI.getState().sheets.length

describe('Goal (Me3GoalSheet)', () => {
  it('is a design system drawer with the three goals, the lines under them and the foot', async () => {
    goalPickSheet()
    const { host, radio } = await renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs h2').textContent).toBe('Goal')
    expect([...host.querySelectorAll('[role="radio"] b')].map(b => b.textContent)).toEqual(['Lose weight', 'Keep my weight', 'Build muscle'])
    expect([...host.querySelectorAll('.g-radio-body span')].map(s => s.textContent)).toEqual([
      'Eat about 20% under your burn', 'Eat about what you burn', 'Eat about 10% over your burn',
    ])
    expect(radio('Lose weight').getAttribute('aria-checked')).toBe('true')
    expect(radio('Build muscle').getAttribute('aria-checked')).toBe('false')
    expect(host.querySelector('.mg-foot').textContent).toBe('Your Daily targets follow the goal you pick. You can still set them by hand.')
  })

  it('picking saves at once, closes, says what changed and Undo puts it back', async () => {
    goalPickSheet()
    const { radio, press } = await renderTop()
    await press(radio('Build muscle'))
    expect(server.calorieGoalFactor).toBe(1.1)
    expect(keysOf()).toEqual(expect.arrayContaining(['calorieGoalFactor', 'goals']))
    expect(sheetsOpen()).toBe(0)
    expect(useUI.getState().toastMsg).toBe('Goal changed to Build muscle')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(server.calorieGoalFactor).toBe(0.8)
  })

  it('picking the goal already set closes with nothing written and no toast', async () => {
    goalPickSheet()
    const { radio, press } = await renderTop()
    await press(radio('Lose weight'))
    expect(sheetsOpen()).toBe(0)
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('a refused write keeps the drawer open and says why', async () => {
    failOn.add('calorieGoalFactor')
    goalPickSheet()
    const { host, radio, press } = await renderTop()
    await press(radio('Keep my weight'))
    expect(sheetsOpen()).toBe(1)
    expect(host.querySelector('[role="alert"]').textContent).toBe('Check your connection and try again.')
    expect(useUI.getState().toastMsg).toBe('')
    expect(server.calorieGoalFactor).toBe(0.8)
  })
})

describe('Target weight (Me3Target)', () => {
  it('starts on the target, reads the gap live and keeps what is typed', async () => {
    targetWeightSheet()
    const { host, field } = await renderTop()
    expect(host.querySelector('.g-bs h2').textContent).toBe('Target weight')
    const f = field('Target weight')
    expect(f.querySelector('input').value).toBe('78.0')
    expect(f.querySelector('.g-tfield-unit').textContent).toBe('kg')
    expect(f.querySelector('.g-tfield-hint').textContent).toMatch(/^3\.4 kg to go from 81\.4 kg\. About \d+ weeks? at \d\.\d kg a week\.$/)
    act(() => type(f.querySelector('input'), '77'))
    expect(f.querySelector('.g-tfield-hint').textContent).toMatch(/^4\.4 kg to go from 81\.4 kg\./)
    act(() => type(f.querySelector('input'), '82,5'))
    expect(f.querySelector('input').value).toBe('82,5')
    expect(f.querySelector('.g-tfield-hint').textContent).toBe('1.1 kg to go from 81.4 kg.')
  })

  it('Save target weight sets it, closes and offers Undo', async () => {
    targetWeightSheet()
    const { host, field, button, press } = await renderTop()
    expect(host.querySelector('.g-bs-foot .g-btn').textContent).toBe('Save target weight')
    act(() => type(field('Target weight').querySelector('input'), '77'))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(77)
    expect(sheetsOpen()).toBe(0)
    expect(useUI.getState().toastMsg).toBe('Target weight changed to 77.0 kg')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(S().targetW).toBe(78)
  })

  it('refuses a weight no person has', async () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    targetWeightSheet()
    const { field, button, press } = await renderTop()
    act(() => type(field('Target weight').querySelector('input'), '9999'))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(78)
    expect(sheetsOpen()).toBe(1)
    expect(toast).toHaveBeenCalledWith('That looks too heavy. Keep it at 700 kg or less.')
  })

  it('refuses an empty field', async () => {
    const toast = vi.fn()
    useUI.setState({ toast })
    targetWeightSheet()
    const { field, button, press } = await renderTop()
    act(() => type(field('Target weight').querySelector('input'), ''))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(78)
    expect(toast).toHaveBeenCalledWith('Enter a valid weight')
  })

  it('Remove target weight clears it, with Undo', async () => {
    targetWeightSheet()
    const { button, press } = await renderTop()
    await press(button('Remove target weight'))
    expect(S().targetW).toBeNull()
    expect(useUI.getState().toastMsg).toBe('Target weight removed')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(S().targetW).toBe(78)
  })

  it('with no target there is nothing to remove, and the field starts on today\'s weight', async () => {
    useStore.setState({ S: baseState({ targetW: null }) })
    targetWeightSheet()
    const { field, button } = await renderTop()
    expect(button('Remove target weight')).toBeUndefined()
    expect(field('Target weight').querySelector('input').value).toBe('81.4')
  })

  it('with no weigh-ins it still saves, and has no pace to show', async () => {
    useStore.setState({ S: baseState({ bodyweight: [], targetW: null }) })
    delete server.weight_kg
    loaded()
    targetWeightSheet()
    const { field, button, press } = await renderTop()
    expect(field('Target weight').querySelector('input').value).toBe('')
    expect(field('Target weight').querySelector('.g-tfield-hint')).toBeNull()
    act(() => type(field('Target weight').querySelector('input'), '75'))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(75)
  })

  it('works without NutriTrace: it is the stored target alone', async () => {
    useStore.setState({ user: null })
    targetWeightSheet()
    const { field, button, press } = await renderTop()
    act(() => type(field('Target weight').querySelector('input'), '76'))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(76)
    expect(calls).toEqual([])
  })

  it('pounds: the unit follows the profile', async () => {
    useStore.setState({ S: baseState({ unit: 'lb', targetW: 172, bodyweight: [{ d: '2026-08-02', w: 187.4 }, { d: '2026-10-20', w: 179.5 }] }) })
    targetWeightSheet()
    const { field } = await renderTop()
    expect(field('Target weight').querySelector('.g-tfield-unit').textContent).toBe('lb')
    expect(field('Target weight').querySelector('input').value).toBe('172.0')
  })
})

describe('Body details (Me3BodySheet), live', () => {
  it('shows height, birth year and sex, with the foot', async () => {
    bodyDetailsSheet()
    const { host, field, button } = await renderTop()
    expect(host.querySelector('.g-bs h2').textContent).toBe('Body details')
    expect(field('Height').querySelector('input').value).toBe('182')
    expect(field('Height').querySelector('.g-tfield-unit').textContent).toBe('cm')
    expect(field('Birth year').querySelector('input').value).toBe('1994')
    expect([...host.querySelectorAll('.g-seg button')].map(b => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Male', 'true'], ['Female', 'false'], ['Prefer not to say', 'false'],
    ])
    expect(host.querySelector('.mg-foot').textContent).toBe('Only used to estimate your burn. Never shown to Friends.')
    expect(button('Save body details')).toBeTruthy()
  })

  it('saves the three, closes and offers Undo', async () => {
    bodyDetailsSheet()
    const { host, field, button, press } = await renderTop()
    act(() => type(field('Height').querySelector('input'), '175'))
    act(() => type(field('Birth year').querySelector('input'), '1990'))
    await press([...host.querySelectorAll('.g-seg button')].find(b => b.textContent === 'Female'))
    await press(button('Save body details'))
    expect(server.height_cm).toBe(175)
    expect(server.dob).toBe('1990-07-01')
    expect(server.gender).toBe('female')
    expect(typeof server.tdee).toBe('number')
    expect(sheetsOpen()).toBe(0)
    expect(useUI.getState().toastMsg).toBe('Body details saved')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(server.height_cm).toBe(182)
    expect(server.gender).toBe('male')
  })

  it('"Prefer not to say" writes tdee from the averaged burn', async () => {
    bodyDetailsSheet()
    const { host, button, press } = await renderTop()
    await press([...host.querySelectorAll('.g-seg button')].find(b => b.textContent === 'Prefer not to say'))
    await press(button('Save body details'))
    expect(server.gender).toBeNull()
    expect(keysOf()).toContain('tdee')
  })

  it('refuses a height or a year the hub would refuse, keeping what was typed', async () => {
    bodyDetailsSheet()
    const { host, field, button, press } = await renderTop()
    act(() => type(field('Height').querySelector('input'), '90'))
    await press(button('Save body details'))
    expect(host.querySelector('[role="alert"]').textContent).toBe('Height must be between 100 and 250 cm.')
    expect(field('Height').querySelector('input').value).toBe('90')
    act(() => type(field('Height').querySelector('input'), '175'))
    act(() => type(field('Birth year').querySelector('input'), '2020'))
    await press(button('Save body details'))
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/^Birth year must be between 1900 and 20\d\d\.$/)
    expect(calls).toEqual([])
    expect(sheetsOpen()).toBe(1)
  })

  it('keeps the typed values when the settings re-read (status loading, data still there) mid-save', async () => {
    bodyDetailsSheet()
    const { host, field, button, press } = await renderTop()
    act(() => type(field('Birth year').querySelector('input'), '1990'))
    act(() => useNutrition.setState({ settings: { status: 'loading', data: clone(server), error: null } }))
    expect(host.querySelector('.mg-sk')).toBeNull()
    expect(field('Birth year').querySelector('input').value).toBe('1990')
    await press(button('Save body details'))
    expect(keysOf()).toContain('dob')
    expect(server.dob).toBe('1990-07-01')
  })

  it('Target weight keeps its typed value through a settings re-read too', async () => {
    targetWeightSheet()
    const { host, field } = await renderTop()
    act(() => type(field('Target weight').querySelector('input'), '75'))
    act(() => useNutrition.setState({ settings: { status: 'loading', data: clone(server), error: null } }))
    expect(host.querySelector('.mg-sk')).toBeNull()
    expect(field('Target weight').querySelector('input').value).toBe('75')
  })

  it('a drawer opened before any settings arrived waits with a skeleton', async () => {
    useNutrition.getState().reset()
    useNutrition.setState({ settings: { status: 'loading', data: null, error: null } })
    vi.mocked(NtApi.getSettings).mockImplementation(() => new Promise(() => {}))
    bodyDetailsSheet()
    const { host } = await renderTop()
    expect(host.querySelector('.mg-sk')).not.toBeNull()
  })

  it('a hub that refuses the profile keys keeps the drawer open and turns the drawer read-only', async () => {
    vi.mocked(NtApi.putSetting).mockImplementation(async key => { calls.push([key]); throw Object.assign(new Error('no'), { status: 400 }) })
    bodyDetailsSheet()
    const { host, field, button, press } = await renderTop()
    act(() => type(field('Height').querySelector('input'), '175'))
    await press(button('Save body details'))
    expect(useProfileWrites.getState().live).toBe(false)
    expect(sheetsOpen()).toBe(1)
    expect(host.querySelector('.g-bs-foot')).toBeNull()
    expect(host.textContent).toContain('Changing this arrives soon')
  })

  it('pounds: feet and inches', async () => {
    useStore.setState({ S: baseState({ unit: 'lb', targetW: 172, bodyweight: [{ d: '2026-10-20', w: 179.5 }] }) })
    bodyDetailsSheet()
    const { field, button, press } = await renderTop()
    expect(field('Feet').querySelector('input').value).toBe('6')
    expect(field('Inches').querySelector('input').value).toBe('0')
    act(() => type(field('Feet').querySelector('input'), '5'))
    act(() => type(field('Inches').querySelector('input'), '11'))
    await press(button('Save body details'))
    expect(server.height_cm).toBe(180)
  })

  it('an empty profile opens empty, and leaves a blank field alone', async () => {
    server = { calorieGoalMode: 'fixed', goals: {} }
    loaded()
    bodyDetailsSheet()
    const { field, button, press } = await renderTop()
    expect(field('Height').querySelector('input').value).toBe('')
    expect(field('Birth year').querySelector('input').value).toBe('')
    act(() => type(field('Height').querySelector('input'), '170'))
    await press(button('Save body details'))
    expect(server.height_cm).toBe(170)
    expect(server.dob).toBeUndefined()
  })

  it('without a weigh-in it says the burn needs one, and Log weight opens as a panel of this drawer', async () => {
    useStore.setState({ S: baseState({ bodyweight: [] }) })
    delete server.weight_kg
    loaded()
    bodyDetailsSheet()
    const { host, button, press } = await renderTop()
    expect(host.textContent).toContain('Your burn estimate needs a weigh-in.')
    await press(button('Log weight'))
    expect(sheetsOpen()).toBe(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
  })

  it('with a weigh-in there is no such line', async () => {
    bodyDetailsSheet()
    const { host } = await renderTop()
    expect(host.textContent).not.toContain('needs a weigh-in')
  })
})

describe('Body details and Daily movement, gated (the hub is not deployed with them)', () => {
  beforeEach(() => useProfileWrites.setState({ live: false }))

  it('Body details opens read-only: the values, the quiet line, no Save', async () => {
    bodyDetailsSheet()
    const { host } = await renderTop()
    expect(host.querySelector('.g-bs h2').textContent).toBe('Body details')
    expect([...host.querySelectorAll('.g-gvr')].map(r => r.textContent)).toEqual(['Height182 cm', 'Birth year1994', 'SexMale'])
    expect(host.querySelector('.mg-foot').textContent).toBe('Changing this arrives soon')
    expect(host.querySelector('input')).toBeNull()
    expect(host.querySelector('.g-bs-foot')).toBeNull()
  })

  it('Daily movement opens read-only with the current level', async () => {
    movementSheet()
    const { host } = await renderTop()
    expect(host.querySelector('.g-gvr').textContent).toBe('Daily movementOn my feet some of the day')
    expect(host.querySelector('.mg-foot').textContent).toBe('Changing this arrives soon')
    expect(host.querySelector('[role="radio"]')).toBeNull()
    expect(calls).toEqual([])
  })

  it('Goal still saves, and never carries a profile key', async () => {
    goalPickSheet()
    const { radio, press } = await renderTop()
    await press(radio('Build muscle'))
    expect(server.calorieGoalFactor).toBe(1.1)
    expect(keysOf().filter(k => ['gender', 'dob', 'height_cm', 'activity', 'tdee'].includes(k))).toEqual([])
  })

  it('Target weight still saves', async () => {
    targetWeightSheet()
    const { field, button, press } = await renderTop()
    act(() => type(field('Target weight').querySelector('input'), '77'))
    await press(button('Save target weight'))
    expect(S().targetW).toBe(77)
  })
})

describe('Daily movement (Me3Movement), live', () => {
  it('four levels with their lines and the foot', async () => {
    movementSheet()
    const { host, radio } = await renderTop()
    expect(host.querySelector('.g-bs h2').textContent).toBe('Daily movement')
    expect([...host.querySelectorAll('[role="radio"] b')].map(b => b.textContent)).toEqual([
      'Mostly sitting', 'On my feet some of the day', 'On my feet most of the day', 'Physical work',
    ])
    expect([...host.querySelectorAll('.g-radio-body span')].map(s => s.textContent)).toEqual([
      'Desk work, little walking', 'Walks, errands, some standing', 'Shop floor, teaching, nursing', 'Building, warehouse, farm',
    ])
    expect(radio('On my feet some of the day').getAttribute('aria-checked')).toBe('true')
    expect(host.querySelector('.mg-foot').textContent).toBe('Workouts and activities are counted separately, in Burned.')
  })

  it('picking saves at once, closes and offers Undo', async () => {
    movementSheet()
    const { radio, press } = await renderTop()
    await press(radio('Physical work'))
    expect(server.activity).toBe('active')
    expect(sheetsOpen()).toBe(0)
    expect(useUI.getState().toastMsg).toBe('Daily movement changed')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(server.activity).toBe('light')
  })

  it('"Prefer not to say" always writes tdee, even when it did not change', async () => {
    delete server.gender
    server.activity = 'light'
    loaded()
    movementSheet()
    const { radio, press } = await renderTop()
    await press(radio('Mostly sitting'))
    const tdee = calls.filter(([k]) => k === 'tdee')
    expect(tdee).toHaveLength(1)
    expect(typeof tdee[0][1]).toBe('number')
  })
})
