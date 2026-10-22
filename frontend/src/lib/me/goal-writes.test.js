// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NtApi } from '../nutrition/api.js'
import { useNutrition } from '../nutrition/store.js'
import { applyWrites, planChange } from './goal-writes.js'

const NOW = Date.UTC(2026, 9, 22)
const settings = (over = {}) => ({
  gender: 'male', dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light', tdee: 2473,
  calorieGoalMode: 'fixed', calorieGoalFactor: 1, waterGoalMl: 2500,
  goals: {
    calories: { max: 2473, sharedGoal: true, isMin: false },
    proteins: { max: 150, sharedGoal: true },
    carbohydrates: { max: 45, isPercent: true, sharedGoal: true },
    fat: { max: 70, sharedGoal: true },
  },
  ...over,
})
const S = { unit: 'kg', targetW: 78, bodyweight: [{ d: '2026-10-20', w: 81.4 }] }
const keys = writes => writes.map(([k]) => k)
const valueOf = (writes, key) => writes.find(([k]) => k === key)?.[1]

describe('planChange', () => {
  it('picking Lose weight: factor 0.8 and the targets, profile keys first', () => {
    const { writes, targets, recomputed } = planChange(settings(), S, { goal: 'lose' }, NOW)
    // age 32, 81.4 kg: burn 2,473 (already stored, so not written again), 20% off = 1,978
    expect(keys(writes)).toEqual(['calorieGoalFactor', 'goals'])
    expect(valueOf(writes, 'calorieGoalFactor')).toBe(0.8)
    expect(recomputed).toBe(true)
    expect(targets).toMatchObject({ burn: 2473, calories: 1978, proteinG: 163, fatG: 55, carbsG: 208 })
    const goals = valueOf(writes, 'goals')
    expect(goals.calories).toMatchObject({ max: 1978, sharedGoal: true, days: Array(7).fill(1978) })
    expect(goals.proteins.max).toBe(163)
    expect(goals.fat.max).toBe(55)
    // carbs were a percentage; the new number is grams
    expect(goals.carbohydrates).toMatchObject({ max: 208, isPercent: false })
  })

  it('water is never touched by a goal', () => {
    expect(keys(planChange(settings(), S, { goal: 'build' }, NOW).writes)).not.toContain('waterGoalMl')
  })

  it('body details: gender, dob, height, tdee, then the factor-free targets for the current goal', () => {
    const base = settings({ calorieGoalFactor: 0.8 })
    const { writes } = planChange(base, S, { sex: 'female', birthYear: 1990, heightCm: 170 }, NOW)
    expect(keys(writes)).toEqual(['gender', 'dob', 'height_cm', 'tdee', 'goals'])
    expect(valueOf(writes, 'gender')).toBe('female')
    expect(valueOf(writes, 'dob')).toBe('1990-07-01')
    expect(valueOf(writes, 'height_cm')).toBe(170)
    // 1062.5 + 813.186 - 177.12 - 161 = 1537.57 x 1.375 = 2114
    expect(valueOf(writes, 'tdee')).toBe(2114)
    expect(valueOf(writes, 'goals').calories.max).toBe(Math.round(2114 * 0.8))
  })

  it('"prefer not to say" clears a set gender and burns the mean of the two', () => {
    const { writes, targets } = planChange(settings({ calorieGoalFactor: 1 }), S, { sex: 'unspecified' }, NOW)
    expect(valueOf(writes, 'gender')).toBeNull()
    const male = planChange(settings(), S, { sex: 'male' }, NOW).targets.burn
    const female = planChange(settings(), S, { sex: 'female' }, NOW).targets.burn
    expect(Math.abs(targets.burn - (male + female) / 2)).toBeLessThanOrEqual(1)
  })

  it('an unset gender stays unset when it is still "prefer not to say"', () => {
    expect(keys(planChange(settings({ gender: undefined }), S, { sex: 'unspecified' }, NOW).writes)).not.toContain('gender')
  })

  it('movement writes the level; an onboarded very_active is only rewritten when picked', () => {
    const base = settings({ activity: 'very_active', calorieGoalFactor: 1 })
    expect(planChange(base, S, {}, NOW).writes.find(([k]) => k === 'activity')).toBeUndefined()
    const { writes, targets } = planChange(base, S, { activity: 'active' }, NOW)
    expect(valueOf(writes, 'activity')).toBe('active')
    expect(targets.burn).toBeLessThan(planChange(base, S, {}, NOW).targets.burn)
    expect(keys(writes).indexOf('activity')).toBeLessThan(keys(writes).indexOf('tdee'))
  })

  it('without a body to work from only the factor is written, and it says the targets were left', () => {
    const plan = planChange(settings({ dob: undefined, height_cm: undefined }), S, { goal: 'lose' }, NOW)
    expect(keys(plan.writes)).toEqual(['calorieGoalFactor'])
    expect(plan.recomputed).toBe(false)
    expect(plan.targets).toBeNull()
  })

  it('a goal with no label (factor 1.2) keeps its targets when the body changes', () => {
    const { writes, recomputed } = planChange(settings({ calorieGoalFactor: 1.2 }), S, { heightCm: 190 }, NOW)
    expect(keys(writes)).toEqual(['height_cm', 'tdee'])
    expect(recomputed).toBe(false)
  })

  it('a capped onboarding factor (0.85) goes back to the nominal one on keep', () => {
    expect(valueOf(planChange(settings({ calorieGoalFactor: 0.85 }), S, { goal: 'keep' }, NOW).writes, 'calorieGoalFactor')).toBe(1)
  })

  it('a macro that differs by weekday is left alone and named', () => {
    const base = settings()
    base.goals.proteins = { sharedGoal: false, days: [100, 100, 100, 100, 100, 150, 150], max: 100 }
    const plan = planChange(base, S, { goal: 'lose' }, NOW)
    expect(plan.skipped).toEqual(['proteins'])
    expect(valueOf(plan.writes, 'goals').proteins).toEqual(base.goals.proteins)
  })

  it('writes nothing when nothing changes', () => {
    const base = settings({ calorieGoalFactor: 0.8 })
    const first = planChange(base, S, { goal: 'lose' }, NOW)
    const applied = { ...base, ...Object.fromEntries(first.writes) }
    expect(planChange(applied, S, { goal: 'lose' }, NOW).writes).toEqual([])
  })
})

describe('applyWrites', () => {
  let server
  let calls
  let failOn

  beforeEach(() => {
    server = settings({ tdee: undefined })
    calls = []
    failOn = new Set()
    useNutrition.getState().reset()
    useNutrition.setState({ settings: { status: 'ready', data: structuredClone(server), error: null } })
    vi.spyOn(NtApi, 'putSetting').mockImplementation(async (key, value) => {
      calls.push([key, value])
      if (failOn.has(key)) throw Object.assign(new Error('refused'), { status: 400 })
      server[key] = value
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('sends the writes in order and returns what the journal needs', async () => {
    const res = await applyWrites([['height_cm', 170], ['tdee', 2400], ['calorieGoalFactor', 0.8]])
    expect(calls).toEqual([['height_cm', 170], ['tdee', 2400], ['calorieGoalFactor', 0.8]])
    expect(res).toEqual({
      ok: true, order: ['height_cm', 'tdee', 'calorieGoalFactor'],
      before: { height_cm: 182, tdee: null, calorieGoalFactor: 1 },
      after: { height_cm: 170, tdee: 2400, calorieGoalFactor: 0.8 },
    })
    expect(useNutrition.getState().settings.data.height_cm).toBe(170)
  })

  it('a failed write rolls back the keys already written, newest first, and reports it', async () => {
    failOn.add('goals')
    const res = await applyWrites([['height_cm', 170], ['calorieGoalFactor', 0.8], ['goals', { calories: { max: 1 } }]])
    expect(res.ok).toBe(false)
    expect(res.error.status).toBe(400)
    expect(res.rolledBack).toBe(true)
    expect(res.stuck).toEqual([])
    expect(calls).toEqual([
      ['height_cm', 170], ['calorieGoalFactor', 0.8], ['goals', { calories: { max: 1 } }],
      ['calorieGoalFactor', 1], ['height_cm', 182],
    ])
    expect(server.height_cm).toBe(182)
    expect(server.calorieGoalFactor).toBe(1)
    expect(server.goals.calories.max).toBe(2473)
  })

  it('a key that was not set goes back as null', async () => {
    failOn.add('calorieGoalFactor')
    await applyWrites([['tdee', 2400], ['calorieGoalFactor', 0.8]])
    expect(calls.at(-1)).toEqual(['tdee', null])
  })

  it('a first write that fails changes nothing and writes nothing back', async () => {
    failOn.add('gender')
    const res = await applyWrites([['gender', 'female'], ['tdee', 2000]])
    expect(res).toMatchObject({ ok: false, rolledBack: true, stuck: [] })
    expect(calls).toEqual([['gender', 'female']])
  })

  it('names the keys it could not put back', async () => {
    failOn.add('goals')
    vi.mocked(NtApi.putSetting).mockImplementation(async (key, value) => {
      calls.push([key, value])
      if (key === 'goals' || (key === 'height_cm' && value === 182)) throw new Error('down')
      server[key] = value
    })
    const res = await applyWrites([['height_cm', 170], ['tdee', 2400], ['goals', {}]])
    expect(res).toMatchObject({ ok: false, rolledBack: false, stuck: ['height_cm'] })
    expect(server.tdee).toBeNull()
  })
})
