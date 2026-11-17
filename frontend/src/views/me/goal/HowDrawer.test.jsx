// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useProfileWrites } from '../../../lib/me/goal-writes.js'
import { openHow } from './HowDrawer.jsx'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

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
let adaptive

const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
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
  const press = async el => { act(() => el.click()); await flush() }
  return { host, button, press, text: () => host.querySelector('.g-bs-body').textContent }
}
const load = () => {
  useNutrition.getState().reset()
  useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  document.body.innerHTML = ''
  useProfileWrites.setState({ live: true })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  server = baseSettings()
  adaptive = { ready: false, daysAvailable: 12, daysRequired: 21 }
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-10-20', w: 81.4 }] }), user: { id: 3 } })
  load()
  vi.spyOn(NtApi, 'getSettings').mockImplementation(async () => clone(server))
  vi.spyOn(NtApi, 'getAdaptiveTdee').mockImplementation(async () => clone(adaptive))
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('How this is worked out (Me3How)', () => {
  it('is a half drawer with three figures and the sentences from the person’s data', async () => {
    openHow()
    const { host, text } = await renderTop()
    expect(useUI.getState().sheets[0].variant).toBe('ds')
    expect(host.querySelector('.g-bs').className).toContain('g-bs-half')
    expect([...host.querySelectorAll('.mg-figs dt')].map(d => d.textContent)).toEqual(['Your burn', 'Goal factor', 'Target'])
    const values = [...host.querySelectorAll('.mg-figs > div')].map(d => [...d.querySelectorAll('dd')].map(x => x.textContent))
    expect(values[0][0]).toMatch(/^2,\d{3} kcal$/)
    expect(values[1]).toEqual(['0.8', 'Lose weight'])
    expect(values[2]).toEqual(['2,100 kcal'])
    const paragraphs = [...host.querySelectorAll('.mg-para')].map(p => p.textContent)
    expect(paragraphs[0]).toMatch(/^Your burn comes from your height, age, sex and daily movement: about 2,\d{3} kcal a day before workouts\.$/)
    expect(paragraphs[1]).toMatch(/^Lose weight takes 20% off: 1,\d{3} kcal a day, about 0\.\d kg a week\.$/)
    expect(paragraphs).toContain('Protein is set to about 1.9 g per kg of your target weight.')
    expect(paragraphs.at(-1)).toBe('Workouts and activities are never added to the target. Burned is shown on its own.')
    expect(text()).not.toContain('Adaptive')
  })

  it('Dynamic follows the burn, workouts included', async () => {
    server.calorieGoalMode = 'dynamic'
    load()
    openHow()
    const { text } = await renderTop()
    expect(text()).toContain('Your target follows your burn, workouts included.')
    expect(text()).not.toContain('never added')
    expect(NtApi.getAdaptiveTdee).not.toHaveBeenCalled()
  })

  it('Adaptive learning: 12 of 21 so far, no Early and no 35-day line', async () => {
    server.calorieGoalMode = 'adaptive'
    load()
    openHow()
    const { host, text } = await renderTop()
    expect(host.querySelector('.mg-adapt-head').textContent).toBe('Adaptive is learning12 of 21 so far')
    expect(text()).not.toContain('Early')
    expect(text()).not.toContain('35 days')
    expect(text()).toContain('never added')
  })

  it('Adaptive ready: the estimate and confidence, and the burn sentence; Early only when the data has the 35-day figure', async () => {
    server.calorieGoalMode = 'adaptive'
    load()
    adaptive = { ready: true, daysAvailable: 28, daysRequired: 21, tdee: 2650, confidence: 0.8 }
    openHow()
    const plain = await renderTop()
    expect(plain.host.querySelector('.mg-adapt-head').textContent).toBe('Adaptive is readyEstimated burn 2,650 kcal a day')
    expect(plain.text()).toContain('Confidence 80%')
    expect(plain.text()).toContain('Your target follows your burn, workouts included.')
    expect(plain.text()).not.toContain('Early')

    useUI.setState({ sheets: [] })
    adaptive = { ...adaptive, daysFull: 35 }
    openHow()
    const early = await renderTop()
    expect(early.host.querySelector('.g-tag').textContent).toBe('Early')
    expect(early.text()).toContain('Firms up at 35 days')
  })

  it('Adaptive that did not answer leaves its block and the workouts sentence out', async () => {
    server.calorieGoalMode = 'adaptive'
    load()
    vi.mocked(NtApi.getAdaptiveTdee).mockRejectedValue(new Error('down'))
    openHow()
    const { host, text } = await renderTop()
    expect(host.querySelector('.mg-adapt')).toBeNull()
    expect(text()).not.toContain('Workouts')
    expect(text()).not.toContain('workouts included')
  })

  it('without a weigh-in or body details there are no figures, and Body details opens as a sub-panel', async () => {
    useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', bodyweight: [] }) })
    delete server.weight_kg
    load()
    openHow()
    const { host, button, press } = await renderTop()
    expect(host.querySelector('.mg-figs')).toBeNull()
    expect(host.querySelector('.mg-para')).toBeNull()
    await press(button('Body details'))
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().sheets[0].panels).toHaveLength(1)
  })

  it('Edit daily targets opens Daily targets as a sub-panel of this drawer, never close-then-open', async () => {
    openHow()
    const { button, press } = await renderTop()
    await press(button('Edit daily targets'))
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(1)
    expect(sheets[0].panels).toHaveLength(1)
    const panel = await renderTop()
    expect(panel.host.querySelector('h2').textContent).toBe('Daily targets')
  })
})
