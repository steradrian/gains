// @vitest-environment happy-dom
// Daily targets (board Ea1Targets): prefilled from the goals NutriTrace has, Start tracking food
// saves them through the goals page's own write and closes; with no calorie target it cannot start.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { createFakeNutriTrace, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { type, useView } from '../../ds/render.test-util.js'
import DailyTargetsSheet from './DailyTargetsSheet.jsx'

const view = useView()
let nt

const input = label => view.host.querySelector(`input[aria-label="${label}"]`)
const start = () => [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Start tracking food')
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }

async function open(settings, close = vi.fn()) {
  nt = createFakeNutriTrace({ days: {}, settings })
  vi.stubGlobal('fetch', nt.fetch)
  view.render(<DailyTargetsSheet close={close} />)
  await settle()
  return close
}

beforeEach(() => {
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

describe('Daily targets', () => {
  it('starts from what is set: calories, protein, carbs in grams (a percentage converted), fat and water', async () => {
    await open(fixtureSettings())
    expect(input('Calories (kcal)').value).toBe('2200')
    expect(input('Protein (g)').value).toBe('160')
    expect(input('Carbs (g)').value).toBe('165')
    expect(input('Fat (g)').value).toBe('70')
    expect(input('Water (ml)').value).toBe('2500')
  })

  it('leaves the "worked out from My goal" line out: the app has no My goal inputs', async () => {
    await open(fixtureSettings())
    expect(view.host.textContent).not.toContain('My goal')
  })

  it('cannot start without a calorie target', async () => {
    await open({ ...fixtureSettings(), goals: {} })
    expect(input('Calories (kcal)').value).toBe('')
    expect(start().disabled).toBe(true)
  })

  it('saves what was typed, in grams, and closes', async () => {
    const close = await open({ ...fixtureSettings(), goals: {} })
    type(input('Calories (kcal)'), '2100')
    type(input('Protein (g)'), '150')
    type(input('Carbs (g)'), '230')
    type(input('Fat (g)'), '70')
    expect(start().disabled).toBe(false)
    await act(async () => { start().click() })
    await settle()
    const goals = nt.state.settings.goals
    expect(goals.calories).toMatchObject({ max: 2100 })
    expect(goals.proteins).toMatchObject({ max: 150 })
    expect(goals.carbohydrates).toMatchObject({ max: 230 })
    expect(goals.carbohydrates.isPercent).toBeFalsy()
    expect(goals.fat).toMatchObject({ max: 70 })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps what was typed and says so when the save fails', async () => {
    const close = await open({ ...fixtureSettings(), goals: {} })
    type(input('Calories (kcal)'), '2100')
    nt.failNext('PUT', '/nt/api/settings', { status: 500 })
    await act(async () => { start().click() })
    await settle()
    expect(view.host.textContent).toContain('Not saved. Try again.')
    expect(input('Calories (kcal)').value).toBe('2100')
    expect(close).not.toHaveBeenCalled()
  })
})
