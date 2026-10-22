// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../../ds/render.test-util.js'
import { DEF, useStore } from '../../../store/useStore.js'
import { NtApi } from '../../../lib/nutrition/api.js'
import { draftOf } from '../../../lib/nutrition/goals.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useProfileWrites } from '../../../lib/me/goal-writes.js'
import { listChanges } from '../../../lib/recent-changes.js'
import { removeEntries } from '../../../lib/recent-changes-store.js'
import { useGoal } from './use-goal.js'

vi.mock('../../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const view = useView()
const clone = v => JSON.parse(JSON.stringify(v))

// Me3Goal's man: male, 182 cm, born 1994, 81.4 kg now (85 at the start), light movement, target 78.
const baseSettings = () => ({
  gender: 'male', dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light',
  calorieGoalMode: 'fixed', calorieGoalFactor: 1, waterGoalMl: 2500,
  goals: {
    calories: { max: 2473, sharedGoal: true },
    proteins: { max: 130, sharedGoal: true },
    carbohydrates: { max: 300, sharedGoal: true },
    fat: { max: 80, sharedGoal: true },
  },
})
const baseState = () => Object.assign(clone(DEF), {
  unit: 'kg', targetW: 78,
  bodyweight: [{ d: '2026-08-02', w: 85 }, { d: '2026-10-20', w: 81.4 }],
})

let server
let calls
let failOn
let out

function Probe() {
  out.current = useGoal()
  return null
}
const mount = async () => { await view.render(<Probe />); await settle() }
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const run = async fn => { let res; await act(async () => { res = await fn() }); return res }
const S = () => useStore.getState().S

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
  localStorage.clear()
  removeEntries()
  useProfileWrites.setState({ live: true })
  out = { current: null }
  server = baseSettings()
  calls = []
  failOn = new Set()
  useStore.setState({ S: baseState(), user: { id: 3 } })
  useNutrition.getState().reset()
  vi.spyOn(NtApi, 'getSettings').mockImplementation(async () => clone(server))
  vi.spyOn(NtApi, 'putSetting').mockImplementation(async (key, value) => {
    calls.push([key, value])
    if (failOn.has(key)) throw Object.assign(new Error('refused'), { status: 400 })
    server[key] = clone(value)
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

describe('useGoal', () => {
  it('loads once and reads the profile, the maths and the weeks left', async () => {
    await mount()
    expect(out.current.status).toBe('ready')
    expect(NtApi.getSettings).toHaveBeenCalledTimes(1)
    expect(out.current.goal).toBe('keep')
    server.calorieGoalFactor = 0.8
    await run(() => out.current.actions.reload())
    const g = out.current
    expect(g.goal).toBe('lose')
    expect(g.target).toBe(78)
    expect(g.current).toMatchObject({ weightKg: 81.4, date: '2026-10-20' })
    expect(g.startWeight).toMatchObject({ w: 85, d: '2026-08-02' })
    expect(g.burn).toBe(2473)
    expect(g.targets).toMatchObject({ calories: 1978, weeklyChangeKg: -0.45 }) // 495 kcal x 7 / 7700
    // 3.4 kg to go at 0.45 kg a week
    expect(g.weeksLeft).toBe(8)
  })

  it('is loading before the settings arrive and error when they cannot be read', async () => {
    NtApi.getSettings.mockImplementation(() => new Promise(() => {}))
    await mount()
    expect(out.current.status).toBe('loading')
    NtApi.getSettings.mockRejectedValue(new Error('down'))
    useNutrition.getState().reset()
    await run(() => useNutrition.getState().loadSettings({ force: true }))
    await settle()
    expect(out.current.status).toBe('error')
  })

  it('setGoal writes the tdee, the factor, then the goals, and journals it', async () => {
    await mount()
    const res = await run(() => out.current.actions.setGoal('lose'))
    expect(res).toMatchObject({ ok: true, changed: true, recomputed: true, skipped: [] })
    expect(calls.map(([k]) => k)).toEqual(['tdee', 'calorieGoalFactor', 'goals'])
    expect(calls[1]).toEqual(['calorieGoalFactor', 0.8])
    const d = draftOf(server)
    expect(d.kcal).toBe(1978)
    expect(d.macros.proteins.value).toBe(163)
    expect(d.macros.carbohydrates.value).toBe(208)
    expect(d.macros.fat.value).toBe(55)
    expect(server.waterGoalMl).toBe(2500)
    expect(out.current.goal).toBe('lose')
    expect(listChanges()).toMatchObject([{ kind: 'goal-change', facts: { what: 'goal', from: 'keep', to: 'lose' }, state: 'open' }])
  })

  it('undo puts every value back and marks the journal entry restored, once', async () => {
    await mount()
    const before = clone(server)
    const res = await run(() => out.current.actions.setGoal('lose'))
    expect(await run(() => res.undo())).toEqual({ ok: true })
    // tdee was not set before: it goes back as null
    expect(server).toEqual({ ...before, tdee: null })
    expect(listChanges()[0].state).toBe('restored')
    expect(await run(() => res.undo())).toMatchObject({ ok: false, reason: 'restored' })
  })

  it('a failed write rolls back what was written, journals nothing and says so', async () => {
    await mount()
    const before = clone(server)
    failOn.add('goals')
    const res = await run(() => out.current.actions.setGoal('lose'))
    expect(res).toMatchObject({ ok: false, changed: false, undo: null, rolledBack: true, stuck: [] })
    expect(res.error.status).toBe(400)
    expect(calls.map(([k]) => k)).toEqual(['tdee', 'calorieGoalFactor', 'goals', 'calorieGoalFactor', 'tdee'])
    expect(server).toEqual({ ...before, tdee: null })
    expect(listChanges()).toEqual([])
  })

  it('reports keys it could not put back', async () => {
    await mount()
    failOn.add('goals')
    NtApi.putSetting.mockImplementation(async (key, value) => {
      calls.push([key, value])
      if (key === 'goals' || (key === 'calorieGoalFactor' && value === 1)) throw new Error('down')
      server[key] = clone(value)
    })
    const res = await run(() => out.current.actions.setGoal('lose'))
    expect(res).toMatchObject({ ok: false, rolledBack: false, stuck: ['calorieGoalFactor'] })
  })

  it('setBodyDetails rewrites sex, birth year, height, the burn and the targets', async () => {
    server.calorieGoalFactor = 0.8
    await mount()
    const res = await run(() => out.current.actions.setBodyDetails({ heightCm: 170, birthYear: 1990, sex: 'female' }))
    expect(res.ok).toBe(true)
    expect(calls.map(([k]) => k)).toEqual(['gender', 'dob', 'height_cm', 'tdee', 'goals'])
    expect(server).toMatchObject({ gender: 'female', dob: '1990-07-01', height_cm: 170, tdee: 2114 })
    expect(draftOf(server).kcal).toBe(1691)
    expect(listChanges()[0].facts).toEqual({
      what: 'body', from: { heightCm: 182, birthYear: 1994, sex: 'male' }, to: { heightCm: 170, birthYear: 1990, sex: 'female' },
    })
  })

  it('"prefer not to say" burns the mean of male and female', async () => {
    server.calorieGoalFactor = 1
    await mount()
    const male = out.current.burn
    await run(() => out.current.actions.setBodyDetails({ sex: 'female' }))
    const female = out.current.burn
    await run(() => out.current.actions.setBodyDetails({ sex: 'unspecified' }))
    expect(out.current.profile.sex).toBe('unspecified')
    expect(server.gender).toBeNull()
    expect(Math.abs(out.current.burn - (male + female) / 2)).toBeLessThanOrEqual(1)
  })

  it('setMovement writes the level and the new burn', async () => {
    server.calorieGoalFactor = 1
    server.activity = 'very_active'
    await mount()
    expect(out.current.profile.movement).toBe('active')
    const res = await run(() => out.current.actions.setMovement('moderate'))
    expect(res.ok).toBe(true)
    expect(calls.map(([k]) => k)).toEqual(['activity', 'tdee', 'goals'])
    expect(server.activity).toBe('moderate')
    // 1798.246 x 1.55 = 2787.3
    expect(server.tdee).toBe(2787)
    expect(out.current.burn).toBe(2787)
    expect(listChanges()[0].facts).toMatchObject({ what: 'movement', from: 'active', to: 'moderate' })
  })

  it('changing nothing writes nothing and offers a no-op undo', async () => {
    server.calorieGoalFactor = 0.8
    await mount()
    await run(() => out.current.actions.setGoal('lose'))
    calls.length = 0
    const res = await run(() => out.current.actions.setGoal('lose'))
    expect(res).toMatchObject({ ok: true, changed: false })
    expect(calls).toEqual([])
    expect(listChanges()).toHaveLength(1)
  })

  it('setTargetWeight writes S.targetW, journals it and undoes it', async () => {
    await mount()
    const res = await run(() => out.current.actions.setTargetWeight(77))
    expect(res).toMatchObject({ ok: true, changed: true })
    expect(S().targetW).toBe(77)
    expect(calls).toEqual([])
    expect(listChanges()[0].facts).toEqual({ what: 'target', from: 78, to: 77, unit: 'kg' })
    await run(() => res.undo())
    expect(S().targetW).toBe(78)
  })

  it('setTargetWeight(null) removes the target and refuses a bad weight', async () => {
    await mount()
    expect((await run(() => out.current.actions.setTargetWeight(0))).ok).toBe(false)
    expect(S().targetW).toBe(78)
    expect((await run(() => out.current.actions.setTargetWeight(null))).ok).toBe(true)
    expect(S().targetW).toBeNull()
  })

  it('keepWeight makes the goal keep and the target today\'s weight, in one undo', async () => {
    server.calorieGoalFactor = 0.8
    await mount()
    const res = await run(() => out.current.actions.keepWeight())
    expect(res.ok).toBe(true)
    expect(server.calorieGoalFactor).toBe(1)
    expect(draftOf(server).kcal).toBe(2473)
    expect(S().targetW).toBe(81.4)
    expect(listChanges()).toHaveLength(1)
    await run(() => res.undo())
    expect(server.calorieGoalFactor).toBe(0.8)
    expect(S().targetW).toBe(78)
  })

  it('keepWeight without a weigh-in refuses', async () => {
    useStore.setState({ S: { ...baseState(), bodyweight: [] } })
    await mount()
    expect(await run(() => out.current.actions.keepWeight())).toMatchObject({ ok: false, error: { code: 'no-weight' } })
  })

  it('saveTargets writes exactly what the Goals page would, and undoes it', async () => {
    await mount()
    const draft = draftOf(server)
    draft.kcal = 2200
    draft.macros.proteins = { ...draft.macros.proteins, value: 160 }
    draft.waterMl = 2800
    const res = await run(() => out.current.actions.saveTargets(draft))
    expect(res.ok).toBe(true)
    expect(calls.map(([k]) => k)).toEqual(['goals', 'waterGoalMl'])
    expect(server.waterGoalMl).toBe(2800)
    expect(listChanges()[0].facts).toMatchObject({
      what: 'targets', from: { calories: 2473, proteinG: 130 }, to: { calories: 2200, proteinG: 160 },
    })
    await run(() => res.undo())
    expect(server.waterGoalMl).toBe(2500)
    expect(draftOf(server).kcal).toBe(2473)
  })

  it('refuses a second action while one is in flight', async () => {
    await mount()
    let release
    NtApi.putSetting.mockImplementationOnce(() => new Promise(r => { release = r }))
    let first
    let second
    await act(async () => {
      first = out.current.actions.setGoal('lose')
      await new Promise(r => setTimeout(r, 0))
      second = await out.current.actions.setGoal('build')
    })
    expect(second).toMatchObject({ ok: false, error: { code: 'busy' } })
    await act(async () => { release(); await first })
  })
})

describe('useGoal without NutriTrace', () => {
  it('has only the target weight', async () => {
    useStore.setState({ user: null })
    await mount()
    const g = out.current
    expect(g.status).toBe('no-nutrition')
    expect(Object.keys(g.actions)).toEqual(['setTargetWeight'])
    expect(g.targets).toBeNull()
    expect(g.burn).toBeNull()
    expect(g.target).toBe(78)
    expect(NtApi.getSettings).not.toHaveBeenCalled()
    const res = await run(() => g.actions.setTargetWeight(75))
    expect(res.ok).toBe(true)
    expect(S().targetW).toBe(75)
  })
})
