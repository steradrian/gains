import { describe, expect, it } from 'vitest'
import { estimateRange } from '../onboarding/estimate.js'
import { ageOf, burnOf, factorOf, targetsFor, weeksTo } from './goal-calc.js'

// Pinned to the hub's own test (gains-hub test/onboarding-targets.test.ts), same inputs, same clock.
// The hub takes the day and the training days; Me takes the movement level they work out to
// (sitting + 3 days = moderate, on feet + 0 = light, physical + 6 = very_active, sitting + 0 = sedentary).
const NOW = Date.UTC(2026, 9, 15, 12)

describe('targetsFor, against the hub', () => {
  it('a man building muscle: burn 2,761, +10%', () => {
    expect(targetsFor({ goal: 'build', sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', now: NOW })).toEqual({
      age: 30, burn: 2761, factor: 1.1, calories: 3037, proteinG: 144, fatG: 84, carbsG: 426, waterMl: 3300, weeklyChangeKg: 0.25, belowFloor: false,
    })
  })

  it('a woman losing weight: burn 1,915, -20% = 1,532', () => {
    expect(targetsFor({ goal: 'lose', sex: 'female', birthYear: 1990, heightCm: 165, weightKg: 70, activity: 'light', now: NOW })).toEqual({
      age: 36, burn: 1915, factor: 0.8, calories: 1532, proteinG: 140, fatG: 43, carbsG: 146, waterMl: 2800, weeklyChangeKg: -0.35, belowFloor: false,
    })
  })

  it('caps a loss at 0.75% of body weight a week: factor 0.85, not 0.8', () => {
    const t = targetsFor({ goal: 'lose', sex: 'male', birthYear: 1996, heightCm: 190, weightKg: 60, activity: 'very_active', now: NOW })
    expect(t).toMatchObject({ burn: 3124, factor: 0.85, calories: 2655 })
    expect(((t.burn - t.calories) * 7) / 7700).toBeLessThanOrEqual(0.0075 * 60)
  })

  it('warns under 1,200 kcal and keeps the number', () => {
    expect(targetsFor({ goal: 'lose', sex: 'female', birthYear: 1950, heightCm: 150, weightKg: 45, activity: 'sedentary', now: NOW }))
      .toMatchObject({ age: 76, burn: 1023, factor: 0.8, calories: 818, belowFloor: true })
  })

  it('keep is maintenance', () => {
    expect(targetsFor({ goal: 'keep', sex: 'unspecified', birthYear: 2000, heightCm: 170, weightKg: 65, activity: 'sedentary', now: NOW }))
      .toMatchObject({ burn: 1807, factor: 1, calories: 1807, weeklyChangeKg: 0 })
  })

  it('never gives negative carbs when protein and fat take the calories', () => {
    expect(targetsFor({ goal: 'lose', sex: 'female', birthYear: 1950, heightCm: 100, weightKg: 400, activity: 'sedentary', now: NOW }).carbsG).toBeGreaterThanOrEqual(0)
  })

  it('a goal it does not know is maintenance, a missing detail is null', () => {
    const body = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', now: NOW }
    expect(targetsFor({ goal: 'unsure', ...body }).calories).toBe(2761)
    expect(targetsFor({ goal: 'keep', ...body, heightCm: null })).toBeNull()
    expect(targetsFor({ goal: 'keep', ...body, birthYear: null })).toBeNull()
    expect(burnOf({ ...body, weightKg: 0 })).toBeNull()
  })

  it('only ever caps a loss (hub factorOf)', () => {
    expect(factorOf('build', 2000, 40)).toBe(1.1)
    expect(factorOf('keep', 2000, 40)).toBe(1)
    expect(factorOf('lose', 2000, 100)).toBe(0.8)
  })
})

describe('"Prefer not to say"', () => {
  const people = [
    { birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate' },
    { birthYear: 1990, heightCm: 165, weightKg: 70, activity: 'light' },
    { birthYear: 1950, heightCm: 150, weightKg: 45, activity: 'sedentary' },
    { birthYear: 2001, heightCm: 195, weightKg: 110, activity: 'very_active' },
    { birthYear: 1985, heightCm: 172, weightKg: 62, activity: 'active' },
  ]

  it('burn equals the mean of the male and female burn (within 1 kcal)', () => {
    for (const p of people) {
      const male = burnOf({ ...p, sex: 'male', now: NOW })
      const female = burnOf({ ...p, sex: 'female', now: NOW })
      const either = burnOf({ ...p, sex: 'unspecified', now: NOW })
      expect(Math.abs(either - (male + female) / 2)).toBeLessThanOrEqual(1)
    }
  })

  it('calories for every goal equal the mean of the male and female calories (within 1 kcal)', () => {
    for (const p of people) {
      for (const goal of ['lose', 'keep', 'build']) {
        const male = targetsFor({ ...p, goal, sex: 'male', now: NOW })
        const female = targetsFor({ ...p, goal, sex: 'female', now: NOW })
        const either = targetsFor({ ...p, goal, sex: 'unspecified', now: NOW })
        // The loss cap can pick a different factor for each sex, so compare the uncapped goals and
        // the capped ones by the burn they start from.
        if (male.factor === female.factor && female.factor === either.factor) {
          expect(Math.abs(either.calories - (male.calories + female.calories) / 2)).toBeLessThanOrEqual(1.5)
        }
        expect(Math.abs(either.burn - (male.burn + female.burn) / 2)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('anything that is not male or female reads as unspecified and never throws', () => {
    const p = { birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', now: NOW }
    for (const sex of [undefined, null, '', 'other']) expect(burnOf({ ...p, sex })).toBe(burnOf({ ...p, sex: 'unspecified' }))
  })

  it('the onboarding estimate uses the same fallback (lib/onboarding/estimate.js)', () => {
    // With all four body answers in, the range is a point: the burn at "sitting", keep, to 50 kcal.
    const year = new Date().getFullYear()
    const body = { sex: 'unspecified', birthYear: year - 31, heightCm: 172, weightKg: 68 }
    const { lo, hi } = estimateRange({ body, goal: 'keep', activity: { value: 'sitting' }, trainingDays: 0 })
    const burn = burnOf({ ...body, activity: 'sedentary', now: Date.UTC(year, 11, 31) })
    expect(lo).toBe(hi)
    expect(Math.abs(lo - burn)).toBeLessThanOrEqual(25)
  })
})

describe('the board person', () => {
  // Me3Goal: male, 182 cm, born 1994, 81.4 kg, on his feet some of the day (light), lose.
  // The board prints burn 2,630 and 2,100 kcal; the hub's formula gives 2,473 and 1,978 for him.
  // 2,630 is what the same man at about 93 kg would burn, so the board numbers are copy, not data;
  // the screens show what this returns.
  const NOV = Date.UTC(2026, 9, 22)
  it('gets the hub numbers, not the board copy', () => {
    const t = targetsFor({ goal: 'lose', sex: 'male', birthYear: 1994, heightCm: 182, weightKg: 81.4, activity: 'light', now: NOV })
    expect(t).toMatchObject({ age: 32, burn: 2473, factor: 0.8, calories: 1978, belowFloor: false })
    expect(burnOf({ sex: 'male', birthYear: 1994, heightCm: 182, weightKg: 93, activity: 'light', now: NOV })).toBe(2632) // 1137.5 + 929.07 - 157.44 + 5 = 1914.13, x 1.375
  })
})

describe('ageOf and weeksTo', () => {
  it('counts whole years from the middle of the birth year, never under 15', () => {
    expect(ageOf(1990, Date.UTC(2026, 5, 30))).toBe(35)
    expect(ageOf(1990, Date.UTC(2026, 6, 2))).toBe(36)
    expect(ageOf(2013, NOW)).toBe(15)
  })

  it('weeks to the target at a weekly rate, null when moving away or without a rate', () => {
    expect(weeksTo(81.4, 78, -0.4)).toBe(9)
    expect(weeksTo(70, 75, 0.25)).toBe(20)
    expect(weeksTo(78, 78, -0.4)).toBe(0)
    expect(weeksTo(81.4, 78, 0.25)).toBeNull()
    expect(weeksTo(81.4, 78, 0)).toBeNull()
    expect(weeksTo(81.4, 78, null)).toBeNull()
    expect(weeksTo(81.4, null, -0.4)).toBeNull()
    expect(weeksTo(81.4, 81.3, -0.4)).toBe(1)
  })
})
