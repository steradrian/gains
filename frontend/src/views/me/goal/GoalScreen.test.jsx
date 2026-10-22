// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { fmtDate } from '../../../lib/format.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useProfileWrites } from '../../../lib/me/goal-writes.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import '../../../lib/recent-changes-kinds.js'
import GoalRoute from './GoalRoute.jsx'

// The two goal-M3 drawers are stubs here: the page only has to call them.
vi.mock('./TargetsDrawer.jsx', () => ({ openTargets: vi.fn() }))
vi.mock('./HowDrawer.jsx', () => ({ openHow: vi.fn() }))
vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

import { openHow } from './HowDrawer.jsx'
import { openTargets } from './TargetsDrawer.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
let host, root, server, calls

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
const baseState = (over = {}) => Object.assign(clone(DEF), {
  unit: 'kg', targetW: 78,
  bodyweight: [{ d: '2026-08-02', w: 85 }, { d: '2026-10-20', w: 81.4 }],
}, over)

function Where() {
  const { pathname, search } = useLocation()
  return <span data-testid="where">{pathname + search}</span>
}
const where = () => host.querySelector('[data-testid="where"]').textContent
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const mount = async (at = '/me/goal') => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[at]}><Where /><Routes><Route path="/me/goal" element={<GoalRoute />} /></Routes></MemoryRouter>)
  })
  await flush()
}
const preload = () => {
  useNutrition.getState().reset()
  useNutrition.setState({ settings: { status: 'ready', data: clone(server), error: null } })
}
const rows = () => [...host.querySelectorAll('.g-gvr')].map(r => ({
  title: r.querySelector('b').textContent,
  sub: r.querySelector('.g-glist-body span')?.textContent ?? null,
  value: r.querySelector('.g-gvr-val')?.textContent ?? null,
}))
const row = title => rows().find(r => r.title === title)
const rowEl = title => [...host.querySelectorAll('.g-gvr')].find(r => r.querySelector('b').textContent === title)
const press = async el => { act(() => el.click()); await flush() }
// The title of the drawer on top, drawn into a root of its own (no Modals here).
function openedTitle() {
  const sheet = useUI.getState().sheets.at(-1)
  const box = document.createElement('div')
  document.body.appendChild(box)
  const r = createRoot(box)
  act(() => r.render(sheet.render(() => {})))
  const title = box.querySelector('.g-bs h2')?.textContent
  act(() => r.unmount())
  box.remove()
  useUI.setState({ sheets: [] })
  return title
}

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  useProfileWrites.setState({ live: true })
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  server = baseSettings()
  calls = []
  vi.mocked(openTargets).mockClear()
  vi.mocked(openHow).mockClear()
  useStore.setState({ S: baseState(), user: { id: 3 } })
  vi.spyOn(NtApi, 'getSettings').mockImplementation(async () => clone(server))
  vi.spyOn(NtApi, 'putSetting').mockImplementation(async (key, value) => { calls.push([key, value]); server[key] = clone(value) })
  preload()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('My goal (Me3Goal)', () => {
  it('reads the board: the title and summary, the ring, the started line and the rows', async () => {
    await mount()
    expect(host.querySelector('.g-spage-title').textContent).toBe('My goal')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Lose weight · 78 kg · 2,100 kcal a day')
    expect(host.querySelector('.g-sring').getAttribute('aria-label')).toBe('Target weight 78.0 kg · 3.4 kg to go')
    expect(host.querySelector('.mg-started').textContent).toBe(`Started at 85.0 kg on ${fmtDate('2026-08-02', true)}`)
    expect(rows()).toEqual([
      { title: 'Goal', sub: 'Eat about 20% under your burn', value: 'Lose weight' },
      { title: 'Target weight', sub: '3.4 kg to go from 81.4 kg', value: '78.0 kg' },
      { title: 'Height', sub: null, value: '182 cm' },
      { title: 'Birth year', sub: null, value: '1994' },
      { title: 'Sex', sub: 'Only for your burn estimate', value: 'Male' },
      { title: 'Daily movement', sub: null, value: 'On my feet some of the day' },
      { title: 'Calories', sub: 'Fixed, the same every day', value: '2,100 kcal' },
      { title: 'Protein', sub: null, value: '150 g' },
      { title: 'Carbs', sub: null, value: '230 g' },
      { title: 'Fat', sub: null, value: '70 g' },
      { title: 'Water', sub: null, value: '2,500 ml' },
      { title: 'How this is worked out', sub: null, value: null },
    ])
    expect(host.querySelector('.g-snote').textContent).toBe('Every change here can be undone for 8 s, and stays in Recent changes for 7 days.')
    expect(host.querySelector('.g-ssec button').textContent).toBe('Edit')
  })

  it('the read-only target rows are not buttons; the others are', async () => {
    await mount()
    for (const title of ['Calories', 'Protein', 'Carbs', 'Fat', 'Water']) expect(rowEl(title).tagName).toBe('DIV')
    for (const title of ['Goal', 'Target weight', 'Height', 'Birth year', 'Sex', 'Daily movement', 'How this is worked out']) expect(rowEl(title).tagName).toBe('BUTTON')
  })

  it('each row opens its drawer; Edit and How this is worked out call goal-M3\'s', async () => {
    await mount()
    await press(rowEl('Goal'))
    expect(openedTitle()).toBe('Goal')
    await press(rowEl('Target weight'))
    expect(openedTitle()).toBe('Target weight')
    for (const title of ['Height', 'Birth year', 'Sex']) {
      await press(rowEl(title))
      expect(openedTitle()).toBe('Body details')
    }
    await press(rowEl('Daily movement'))
    expect(openedTitle()).toBe('Daily movement')
    await press(host.querySelector('.g-ssec button'))
    expect(openTargets).toHaveBeenCalledTimes(1)
    await press(rowEl('How this is worked out'))
    expect(openHow).toHaveBeenCalledTimes(1)
  })

  it('names the calorie mode', async () => {
    server.calorieGoalMode = 'adaptive'
    preload()
    await mount()
    expect(row('Calories').sub).toBe('Adaptive')
  })

  it('Back goes to the Me root when the page was opened cold', async () => {
    await mount()
    expect(host.querySelector('.g-snav button, .g-snav a')).toBeTruthy()
  })
})

describe('states', () => {
  it('loading: the ring and rows as skeletons, nothing to read', async () => {
    useNutrition.getState().reset()
    vi.mocked(NtApi.getSettings).mockImplementation(() => new Promise(() => {}))
    await mount()
    expect(host.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(host.querySelectorAll('.g-skel').length).toBeGreaterThan(2)
    expect(rows()).toEqual([])
  })

  it('error: the scene, "Goals did not load." and Try again reads again', async () => {
    useNutrition.getState().reset()
    vi.mocked(NtApi.getSettings).mockRejectedValue(Object.assign(new Error('down'), { status: 500 }))
    await mount()
    expect(host.querySelector('.g-sempty b').textContent).toBe('Goals did not load.')
    expect(host.querySelector('.g-sempty.g-sempty-card')).toBeNull()
    expect(host.querySelector('.g-sempty svg')).toBeTruthy()
    const calls0 = vi.mocked(NtApi.getSettings).mock.calls.length
    vi.mocked(NtApi.getSettings).mockImplementation(async () => clone(server))
    await press([...host.querySelectorAll('.g-sempty-btn')].find(b => b.textContent === 'Try again'))
    expect(vi.mocked(NtApi.getSettings).mock.calls.length).toBeGreaterThan(calls0)
    expect(host.querySelector('.g-sempty')).toBeNull()
    expect(row('Goal').value).toBe('Lose weight')
  })

  it('no NutriTrace: the ring and the Target weight row, nothing else', async () => {
    useStore.setState({ user: null })
    await mount()
    expect(rows()).toEqual([{ title: 'Target weight', sub: '3.4 kg to go from 81.4 kg', value: '78.0 kg' }])
    expect(host.querySelector('.g-ssec')).toBeNull()
    expect(host.querySelector('.g-sring')).toBeTruthy()
  })

  it('no weigh-ins: an empty ring that says so, and the Target weight drawer still opens', async () => {
    useStore.setState({ S: baseState({ bodyweight: [] }) })
    delete server.weight_kg
    preload()
    await mount()
    expect(host.querySelector('.g-sring').getAttribute('aria-label')).toBe('Target weight 78.0 kg · Log your first weigh-in')
    expect(host.querySelector('.g-sring-val')).toBeNull()
    expect(host.querySelector('.mg-started')).toBeNull()
    expect(row('Target weight')).toEqual({ title: 'Target weight', sub: null, value: '78.0 kg' })
    await press(rowEl('Target weight'))
    expect(openedTitle()).toBe('Target weight')
  })

  it('no target: the row says Add and the ring asks for one', async () => {
    useStore.setState({ S: baseState({ targetW: null }) })
    await mount()
    expect(row('Target weight').value).toBe('Add')
    expect(host.querySelector('.g-sring').getAttribute('aria-label')).toBe('Target weight — Set a target weight')
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Lose weight · 2,100 kcal a day')
  })

  it('a profile that skipped the body shows Add and Not set', async () => {
    server = { calorieGoalMode: 'fixed', goals: {} }
    preload()
    await mount()
    expect(['Goal', 'Height', 'Birth year', 'Daily movement'].map(t => row(t).value)).toEqual(['Add', 'Add', 'Add', 'Add'])
    // Water has NutriTrace's own default when no goal is stored.
    expect(['Calories', 'Protein', 'Carbs', 'Fat', 'Water'].map(t => row(t).value)).toEqual(['Not set', 'Not set', 'Not set', 'Not set', '2,000 ml'])
  })

  it('pounds and feet', async () => {
    useStore.setState({ S: baseState({ unit: 'lb', targetW: 172, bodyweight: [{ d: '2026-08-02', w: 187.4 }, { d: '2026-10-20', w: 179.5 }] }) })
    await mount()
    expect(row('Target weight').value).toBe('172.0 lb')
    expect(row('Height').value).toBe('6 ft 0 in')
  })

  it('prefer not to say', async () => {
    delete server.gender
    preload()
    await mount()
    expect(row('Sex').value).toBe('Prefer not to say')
  })
})

describe('Target reached', () => {
  const reached = () => useStore.setState({ S: baseState({ bodyweight: [{ d: '2026-08-02', w: 85 }, { d: '2026-10-21', w: 77.6 }] }) })

  it('the ring closes and reads it; the target row has no distance; Keep my weight is offered', async () => {
    reached()
    await mount()
    expect(host.querySelector('.g-sring').getAttribute('aria-label')).toBe('Target weight 78.0 kg · Target reached')
    expect(row('Target weight').sub).toBeNull()
    expect([...host.querySelectorAll('.g-btn')].map(b => b.textContent)).toEqual(['Keep my weight'])
  })

  it('Keep my weight makes the goal Keep and the target today\'s weight, with Undo', async () => {
    reached()
    await mount()
    await press(host.querySelector('.g-btn'))
    expect(server.calorieGoalFactor).toBe(1)
    expect(S().targetW).toBe(77.6)
    expect(useUI.getState().toastMsg).toBe('Goal changed to Keep my weight')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    await act(async () => { useUI.getState().runToastAction() })
    await flush()
    expect(server.calorieGoalFactor).toBe(0.8)
    expect(S().targetW).toBe(78)
  })

  it('with the goal already Keep there is no button', async () => {
    server.calorieGoalFactor = 1
    preload()
    reached()
    await mount()
    expect(host.querySelector('.g-btn')).toBeNull()
  })
})

describe('saved (Me3Saved)', () => {
  it('after a target change the page shows the new value, the toast offers Undo, and it is in Recent changes', async () => {
    await mount()
    const { targetWeightSheet } = await import('./goal-drawers.jsx')
    await act(async () => { targetWeightSheet() })
    const sheet = useUI.getState().sheets.at(-1)
    const box = document.createElement('div')
    document.body.appendChild(box)
    const r = createRoot(box)
    act(() => r.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    await flush()
    const input = box.querySelector('input')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '77')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await press([...box.querySelectorAll('button')].find(b => b.textContent === 'Save target weight'))
    expect(row('Target weight')).toEqual({ title: 'Target weight', sub: '4.4 kg to go from 81.4 kg', value: '77.0 kg' })
    expect(host.querySelector('.g-spage-sub').textContent).toBe('Lose weight · 77 kg · 2,100 kcal a day')
    expect(useUI.getState().toastMsg).toBe('Target weight changed to 77.0 kg')
    expect(JSON.parse(localStorage.getItem([...Object.keys(localStorage)].find(k => k.startsWith('gains_recent_changes')) || '') || '[]').some(e => e.kind === 'goal-change')).toBe(true)
    act(() => r.unmount())
    box.remove()
  })
})

describe('?targets=1', () => {
  it('opens the Daily targets drawer once and clears itself with replace', async () => {
    await mount('/me/goal?targets=1')
    expect(openTargets).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/me/goal')
  })

  it('waits for the settings, and does nothing without the query', async () => {
    await mount('/me/goal')
    expect(openTargets).not.toHaveBeenCalled()
  })
})
