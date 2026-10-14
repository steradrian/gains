// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { createFakeNutriTrace, fixtureSettings } from '../lib/nutrition/fake-nutritrace.js'
import { bindUI } from '../components/ui.jsx'
import NutritionGoals from './NutritionGoals.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let nt
let root
let host

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const text = () => host.textContent
const byLabel = label => host.querySelector(`[aria-label="${label}"]`)
const click = el => act(() => { el.click() })
const clickText = (label, tag = 'button') => click([...host.querySelectorAll(tag)].find(b => b.textContent.trim() === label))
const field = label => byLabel('Increase ' + label).closest('.stp').querySelector('input')
const saveButton = () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Save goals')
const goalWrites = () => nt.writes().filter(w => w.path === '/nt/api/settings')

async function open(opts = {}) {
  nt = createFakeNutriTrace(opts)
  vi.stubGlobal('fetch', nt.fetch)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<NutritionGoals />) })
  await settle()
}

beforeEach(() => {
  bindUI({ getState: () => ({ openSheet: vi.fn(), toast: vi.fn() }) })
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
})
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  vi.unstubAllGlobals()
})

describe('Nutrition › Goals', () => {
  it('shows what NutriTrace has saved', async () => {
    await open()
    expect(field('Daily target').value).toBe('2200')
    expect(field('Protein').value).toBe('160')
    expect(field('Daily water goal').value).toBe('2500')
    expect(saveButton().disabled).toBe(true)
  })

  it('saves a changed calorie target and nothing else', async () => {
    await open()
    click(byLabel('Increase Daily target'))
    expect(saveButton().disabled).toBe(false)
    await click(saveButton())
    await settle()
    expect(goalWrites().map(w => w.body.key)).toEqual(['goals'])
    expect(nt.state.settings.goals.calories).toMatchObject({ max: 2250, sharedGoal: true })
    expect(nt.state.settings.goals.proteins).toEqual({ max: 160 })
    expect(saveButton().disabled).toBe(true)
  })

  it('keeps the input and says so when the save fails, then saves on retry', async () => {
    await open()
    click(byLabel('Increase Daily target'))
    nt.failNext('PUT', '/nt/api/settings', { status: 500 })
    await click(saveButton())
    await settle()
    expect(text()).toContain('NutriTrace had a problem. Try again.')
    expect(text()).not.toContain('upstream_error')
    expect(field('Daily target').value).toBe('2250')
    expect(nt.state.settings.goals.calories.max).toBe(2200)
    await click(saveButton())
    await settle()
    expect(nt.state.settings.goals.calories.max).toBe(2250)
    expect(text()).not.toContain('NutriTrace had a problem')
  })

  it('switches the calorie mode and its factor', async () => {
    await open()
    clickText('Adaptive')
    clickText('Lose −20%')
    await click(saveButton())
    await settle()
    expect(nt.state.settings).toMatchObject({ calorieGoalMode: 'adaptive', calorieGoalFactor: 0.8 })
    expect(goalWrites().map(w => w.body.key).sort()).toEqual(['calorieGoalFactor', 'calorieGoalMode'])
  })

  it('shows how far the adaptive estimate has got, and the estimate once it is ready', async () => {
    await open({ settings: { ...fixtureSettings(), calorieGoalMode: 'adaptive' }, adaptiveTdee: { ready: false, daysAvailable: 9, daysRequired: 21 } })
    expect(text()).toContain('9 of 21 days')
    act(() => root.unmount())
    host.remove()
    useNutrition.getState().reset()
    await open({ settings: { ...fixtureSettings(), calorieGoalMode: 'adaptive' }, adaptiveTdee: { ready: true, tdee: 2600, trendKgPerWeek: -0.3, confidence: 0.8, daysAvailable: 35, daysRequired: 21 } })
    expect(text()).toContain('2,600 kcal')
    expect(text()).toContain('80%')
    expect(text()).toContain('Target today')
  })

  it('does not offer Dynamic without a wearable', async () => {
    await open()
    clickText('Dynamic')
    expect(text()).toContain('Dynamic needs a connected wearable.')
    expect(saveButton().disabled).toBe(true)
  })

  it('offers Dynamic with a wearable and shows yesterday’s burn', async () => {
    await open({ settings: { ...fixtureSettings(), garminEnabled: true }, caloriesOut: { [todayISO()]: 2400 } })
    clickText('Dynamic')
    expect(saveButton().disabled).toBe(false)
    expect(text()).toContain('2,400 kcal')
  })

  it('lets a workout raise the target in Fixed, and turns the diary activity line on with it', async () => {
    await open({ settings: { ...fixtureSettings(), diaryShowActivity: false } })
    const sw = byLabel('Count workouts toward the target')
    expect(sw.disabled).toBe(false)
    click(sw)
    await click(saveButton())
    await settle()
    expect(nt.state.settings).toMatchObject({ calorieAdjustFromActivity: true, diaryShowActivity: true })
  })

  it('never lets a workout change the target once Adaptive is ready', async () => {
    await open({
      settings: { ...fixtureSettings(), calorieGoalMode: 'adaptive', calorieAdjustFromActivity: true },
      adaptiveTdee: { ready: true, tdee: 2600, daysAvailable: 35, daysRequired: 21 },
    })
    expect(byLabel('Count workouts toward the target').disabled).toBe(true)
    expect(text()).toContain('Your target already includes training.')
    expect(saveButton().disabled).toBe(true)
  })

  it('hides the workout setting in Dynamic when it was never on', async () => {
    await open({ settings: { ...fixtureSettings(), calorieGoalMode: 'dynamic', garminEnabled: true } })
    expect(byLabel('Count workouts toward the target')).toBeNull()
  })

  it('converts a macro between grams and percent without moving its target', async () => {
    await open()
    // Carbs are saved as 30 %: against 2200 kcal that is 165 g, and back.
    expect(field('Carbs').value).toBe('30')
    const row = byLabel('Increase Carbs').closest('.lrow')
    await click([...row.querySelectorAll('.seg button')].find(b => b.textContent === 'g'))
    expect(field('Carbs').value).toBe('165')
    await click(saveButton())
    await settle()
    expect(nt.state.settings.goals.carbohydrates).toMatchObject({ max: 165, isPercent: false })
  })

  it('saves a template, applies it to the page and only writes on Save', async () => {
    await open()
    const input = host.querySelector('input[placeholder="Template name"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Maintenance')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Save template'))
    await settle()
    expect(nt.state.settings.goalTemplates).toHaveLength(1)
    expect(nt.state.settings.goalTemplates[0]).toMatchObject({ name: 'Maintenance', waterGoalMl: 2500 })
    expect(nt.state.settings.goalTemplates[0].goals.calories.max).toBe(2200)

    nt.state.settings.goalTemplates[0].goals.calories.max = 1800
    nt.state.settings.goalTemplates[0].goals.calories.min = 1800
    await act(async () => { useNutrition.getState().loadSettings({ force: true }) })
    await settle()
    const before = goalWrites().length
    await clickText('Apply')
    expect(field('Daily target').value).toBe('1800')
    expect(goalWrites()).toHaveLength(before)
    await click(saveButton())
    await settle()
    expect(nt.state.settings.goals.calories.max).toBe(1800)
  })

  it('shows an error with a retry when the settings cannot be read', async () => {
    nt = createFakeNutriTrace()
    nt.failNext('GET', '/nt/api/settings', 'offline')
    vi.stubGlobal('fetch', nt.fetch)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => { root.render(<NutritionGoals />) })
    await settle()
    expect(text()).toContain('No connection to NutriTrace.')
    await clickText('Try again')
    await settle()
    expect(field('Daily target').value).toBe('2200')
  })

  it('asks for nothing without an account', async () => {
    useStore.setState({ user: null })
    await open()
    expect(text()).toContain('Nutrition needs an account')
    expect(nt.requests).toHaveLength(0)
  })
})
