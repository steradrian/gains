// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { birthYearOf, calcInputs, dobOf, goalOfFactor, movementOf, profileOf, sexOf } from './goal-profile.js'

const settings = (over = {}) => ({
  gender: 'male', dob: '1994-07-01', height_cm: 182, weight_kg: 90, activity: 'light',
  calorieGoalMode: 'fixed', calorieGoalFactor: 0.8, waterGoalMl: 2500,
  goals: {
    calories: { max: 2100, sharedGoal: true },
    proteins: { max: 150, sharedGoal: true },
    carbohydrates: { max: 45, isPercent: true, sharedGoal: true },
    fat: { max: 70, sharedGoal: true },
  },
  ...over,
})
const S = (over = {}) => ({
  unit: 'kg', targetW: 78,
  bodyweight: [{ d: '2026-08-02', w: 85 }, { d: '2026-10-20', w: 81.4 }, { d: '2026-09-10', w: 83 }],
  ...over,
})

describe('profileOf', () => {
  it('reads the profile, the targets and the weigh-ins', () => {
    const p = profileOf(settings(), S())
    expect(p).toMatchObject({
      sex: 'male', birthYear: 1994, heightCm: 182, activity: 'light', movement: 'light', goal: 'lose', factor: 0.8, mode: 'fixed',
      current: { weightKg: 81.4, date: '2026-10-20', fromOnboarding: false },
      start: { w: 85, weightKg: 85, d: '2026-08-02' },
      target: 78, targetKg: 78, calories: 2100, water: 2500,
    })
    // 45% of 2,100 kcal at 4 kcal a gram
    expect(p.macros).toEqual({ proteinG: 150, carbsG: 236, fatG: 70 })
  })

  it('the latest weigh-in is current whatever the stored order, the first is the start', () => {
    const p = profileOf(settings(), S())
    expect(p.current.date).toBe('2026-10-20')
    expect(p.start.d).toBe('2026-08-02')
  })

  it('with no weigh-ins current is the onboarding weight, flagged, and there is no start', () => {
    const p = profileOf(settings(), S({ bodyweight: [] }))
    expect(p.current).toEqual({ weightKg: 90, w: 90, date: null, fromOnboarding: true })
    expect(p.start).toBeNull()
  })

  it('no weigh-ins and no onboarding weight: no current', () => {
    expect(profileOf(settings({ weight_kg: undefined }), S({ bodyweight: [] })).current).toBeNull()
  })

  it('a lb profile: weigh-ins and target are lb, the maths is kg', () => {
    const p = profileOf(settings(), S({ unit: 'lb', targetW: 172, bodyweight: [{ d: '2026-08-02', w: 187.4 }, { d: '2026-10-20', w: 179.4 }] }))
    expect(p.unit).toBe('lb')
    expect(p.current.weightKg).toBeCloseTo(81.4, 1)
    expect(p.current.w).toBe(179.4)
    expect(p.start).toMatchObject({ w: 187.4, d: '2026-08-02' })
    expect(p.start.weightKg).toBeCloseTo(85, 1)
    expect(p.target).toBe(172)
    expect(p.targetKg).toBeCloseTo(78, 1)
  })

  it('"prefer not to say" is an unset gender; very_active reads as active but is kept for the maths', () => {
    const p = profileOf(settings({ gender: undefined, activity: 'very_active' }), S())
    expect(p.sex).toBe('unspecified')
    expect(p.movement).toBe('active')
    expect(p.activity).toBe('very_active')
  })

  it('works without NutriTrace: only the target weight and the weigh-ins', () => {
    const p = profileOf(null, S())
    expect(p).toMatchObject({ sex: 'unspecified', birthYear: null, heightCm: null, goal: null, calories: null, water: null, target: 78 })
    expect(p.current.weightKg).toBe(81.4)
    expect(calcInputs(p)).toBeNull()
  })

  it('a macro that differs by weekday has no single number', () => {
    const goals = { calories: { max: 2100, sharedGoal: true }, proteins: { sharedGoal: false, days: [100, 100, 100, 100, 100, 150, 150] } }
    expect(profileOf(settings({ goals }), S()).macros.proteinG).toBeNull()
  })
})

describe('the pieces', () => {
  it('goal from the factor: 0.8, 1, 1.1, a capped loss; anything else has no label', () => {
    expect(goalOfFactor(0.8)).toBe('lose')
    expect(goalOfFactor(0.85)).toBe('lose')
    expect(goalOfFactor(1)).toBe('keep')
    expect(goalOfFactor(1.1)).toBe('build')
    expect(goalOfFactor(1.2)).toBeNull()
    expect(goalOfFactor(0.5)).toBeNull()
    expect(goalOfFactor(undefined)).toBeNull()
  })

  it('movement, sex and birth year', () => {
    expect(movementOf('sedentary')).toBe('sedentary')
    expect(movementOf('very_active')).toBe('active')
    expect(movementOf('nonsense')).toBeNull()
    expect(sexOf('female')).toBe('female')
    expect(sexOf(undefined)).toBe('unspecified')
    expect(birthYearOf('1994-07-01')).toBe(1994)
    expect(birthYearOf(null)).toBeNull()
    expect(dobOf(1994)).toBe('1994-07-01')
  })

  it('calcInputs wants a birth year, a height and a weight', () => {
    const p = profileOf(settings(), S())
    expect(calcInputs(p)).toEqual({ goal: 'lose', sex: 'male', birthYear: 1994, heightCm: 182, weightKg: 81.4, activity: 'light' })
    expect(calcInputs({ ...p, heightCm: null })).toBeNull()
    expect(calcInputs(p, { weightKg: 70 }).weightKg).toBe(70)
  })
})
