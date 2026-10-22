import { describe, expect, it } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import {
  birthYearMax, cmOfFeet, feetOf, goalLabel, goalSub, goalViewOf, heightText, movementLabel, parseWeight, progressOf, sexLabel, targetPreview, weightText,
} from './goal-data.js'

const fmt = { energy: k => k.toLocaleString('en-US') + ' kcal', water: ml => ml.toLocaleString('en-US') + ' ml' }

// Me3Goal's man: lose, 81.4 kg now, 85 at the start, target 78, 2,100 kcal fixed.
const man = (over = {}, profile = {}) => ({
  profile: {
    unit: 'kg', sex: 'male', birthYear: 1994, heightCm: 182, activity: 'light', movement: 'light', goal: 'lose', factor: 0.8, mode: 'fixed',
    current: { weightKg: 81.4, date: '2026-10-20', fromOnboarding: false },
    start: { w: 85, weightKg: 85, d: '2026-08-02' },
    target: 78, targetKg: 78, calories: 2100, macros: { proteinG: 150, carbsG: 230, fatG: 70 }, water: 2500,
    ...profile,
  },
  targets: { factor: 0.8, weeklyChangeKg: -0.5 },
  startWeight: { w: 85, weightKg: 85, d: '2026-08-02' },
  ...over,
})

describe('goalViewOf', () => {
  it('reads the board: ring, summary, started line and every row', () => {
    const v = goalViewOf(man(), fmt)
    expect(v.ring).toMatchObject({ top: 'Target weight', big: '78.0', unit: 'kg · 3.4 kg to go', max: 1 })
    expect(v.ring.value).toBeCloseTo(3.6 / 7, 5)
    expect(v.summary).toBe('Lose weight · 78 kg · 2,100 kcal a day')
    expect(v.started).toBe(`Started at 85.0 kg on ${fmtDate('2026-08-02', true)}`)
    expect(v.goal).toEqual({ title: 'Goal', value: 'Lose weight', sub: 'Eat about 20% under your burn' })
    expect(v.target).toEqual({ title: 'Target weight', value: '78.0 kg', sub: '3.4 kg to go from 81.4 kg' })
    expect(v.height.value).toBe('182 cm')
    expect(v.birthYear.value).toBe('1994')
    expect(v.sex).toEqual({ title: 'Sex', value: 'Male', sub: 'Only for your burn estimate' })
    expect(v.movement.value).toBe('On my feet some of the day')
    expect(v.calories).toEqual({ title: 'Calories', value: '2,100 kcal', sub: 'Fixed, the same every day' })
    expect([v.protein.value, v.carbs.value, v.fat.value, v.water.value]).toEqual(['150 g', '230 g', '70 g', '2,500 ml'])
    expect(v.reached).toBe(false)
    expect(v.canKeep).toBe(false)
  })

  it('the calorie row names the mode', () => {
    expect(goalViewOf(man({}, { mode: 'adaptive' }), fmt).calories.sub).toBe('Adaptive')
    expect(goalViewOf(man({}, { mode: 'dynamic' }), fmt).calories.sub).toBe('Dynamic')
  })

  it('target reached: the ring closes, reads it, and offers Keep my weight', () => {
    const v = goalViewOf(man({}, { current: { weightKg: 77.6, date: '2026-10-21', fromOnboarding: false } }), fmt)
    expect(v.reached).toBe(true)
    expect(v.ring.value).toBe(1)
    expect(v.ring.unit).toBe('kg · Target reached')
    expect(v.canKeep).toBe(true)
    expect(v.target.sub).toBeNull()
  })

  it('target reached with the goal already Keep offers nothing', () => {
    const v = goalViewOf(man({}, { goal: 'keep', current: { weightKg: 78, date: '2026-10-21', fromOnboarding: false } }), fmt)
    expect(v.reached).toBe(true)
    expect(v.canKeep).toBe(false)
  })

  it('no target: an empty ring that asks for one, and Add on the row', () => {
    const v = goalViewOf(man({}, { target: null, targetKg: null }), fmt)
    expect(v.ring).toMatchObject({ big: '–', unit: 'Set a target weight', value: 0 })
    expect(v.target).toEqual({ title: 'Target weight', value: 'Add', sub: null })
    expect(v.summary).toBe('Lose weight · 2,100 kcal a day')
  })

  it('no weigh-ins: the ring is empty and says so; no started line', () => {
    const v = goalViewOf(man({ startWeight: null }, { current: null, start: null }), fmt)
    expect(v.ring.value).toBe(0)
    expect(v.ring.unit).toBe('kg · Log your first weigh-in')
    expect(v.started).toBeNull()
    expect(v.target.sub).toBeNull()
  })

  it('a profile that skipped the body shows Add and Not set', () => {
    const v = goalViewOf(man({ targets: null }, {
      heightCm: null, birthYear: null, movement: null, goal: null, factor: null, calories: null, water: null, macros: { proteinG: null, carbsG: null, fatG: null },
    }), fmt)
    expect([v.height.value, v.birthYear.value, v.movement.value, v.goal.value]).toEqual(['Add', 'Add', 'Add', 'Add'])
    expect(v.goal.sub).toBeNull()
    expect([v.calories.value, v.protein.value, v.water.value]).toEqual(['Not set', 'Not set', 'Not set'])
    expect(v.calories.sub).toBeNull()
    expect(v.summary).toBe('78 kg')
  })

  it('a pound profile reads in pounds and feet', () => {
    const start = { w: 187.4, weightKg: 85, d: '2026-08-02' }
    const v = goalViewOf(man({ startWeight: start }, { unit: 'lb', start, target: 172, current: { weightKg: 81.4, date: '2026-10-20', fromOnboarding: false } }), fmt)
    expect(v.target.value).toBe('172.0 lb')
    expect(v.target.sub).toBe('7.5 lb to go from 179.5 lb')
    expect(v.started).toContain('Started at 187.4 lb')
    expect(v.height.value).toBe('6 ft 0 in')
  })

  it('an lb weigh-in on the target reads as reached, not 0.1 lb off (no lb -> kg -> lb round trip)', () => {
    const start = { w: 190, weightKg: 86.2, d: '2026-08-02' }
    const current = { weightKg: 81.6, w: 180, date: '2026-10-20', fromOnboarding: false }
    const v = goalViewOf(man({ startWeight: start }, { unit: 'lb', goal: 'keep', start, target: 180, current }), fmt)
    expect(v.reached).toBe(true)
    expect(v.ring.unit).toBe('lb · Target reached')
    expect(v.target.sub).toBeNull()
  })

  it('a kg weigh-in on the target still reads as reached', () => {
    const v = goalViewOf(man({}, { goal: 'keep', target: 81.4 }), fmt)
    expect(v.reached).toBe(true)
  })

  it('prefer not to say', () => {
    expect(goalViewOf(man({}, { sex: 'unspecified' }), fmt).sex.value).toBe('Prefer not to say')
  })
})

describe('labels and numbers', () => {
  it('goal names and the real percentage', () => {
    expect([goalLabel('lose'), goalLabel('keep'), goalLabel('build'), goalLabel(null)]).toEqual(['Lose weight', 'Keep my weight', 'Build muscle', null])
    expect(goalSub('lose', 0.8)).toBe('Eat about 20% under your burn')
    expect(goalSub('lose', 0.85)).toBe('Eat about 15% under your burn')
    expect(goalSub('keep', 1)).toBe('Eat about what you burn')
    expect(goalSub('build', 1.1)).toBe('Eat about 10% over your burn')
    expect(goalSub(null, null)).toBeNull()
  })

  it('movement and sex', () => {
    expect(movementLabel('sedentary')).toBe('Mostly sitting')
    expect(movementLabel('active')).toBe('Physical work')
    expect(movementLabel(null)).toBeNull()
    expect([sexLabel('male'), sexLabel('female'), sexLabel('unspecified')]).toEqual(['Male', 'Female', 'Prefer not to say'])
  })

  it('weights keep one decimal; a typed weight is a tenth, junk is 0', () => {
    expect(weightText(78)).toBe('78.0')
    expect(parseWeight('77,04')).toBe(77)
    expect(parseWeight('77.06')).toBe(77.1)
    expect(parseWeight('abc')).toBe(0)
    expect(parseWeight('')).toBe(0)
  })

  it('height in feet and inches, and back', () => {
    expect(feetOf(182)).toEqual({ ft: 6, inch: 0 })
    expect(feetOf(180)).toEqual({ ft: 5, inch: 11 })
    expect(cmOfFeet(5, 11)).toBe(180)
    expect(heightText(null, 'kg')).toBeNull()
  })

  it('the birth year cannot be under 13', () => {
    expect(birthYearMax(Date.UTC(2026, 9, 22))).toBe(2013)
  })
})

describe('progressOf', () => {
  it('a loss: from the start to the target', () => {
    expect(progressOf({ current: 81.5, start: 85, target: 78, goal: 'lose' })).toEqual({ value: 0.5, reached: false })
  })
  it('a gain', () => {
    expect(progressOf({ current: 72, start: 70, target: 74, goal: 'build' })).toEqual({ value: 0.5, reached: false })
    expect(progressOf({ current: 74.2, start: 70, target: 74, goal: 'build' })).toEqual({ value: 1, reached: true })
  })
  it('moving the wrong way is an empty ring, not a negative one', () => {
    expect(progressOf({ current: 86, start: 85, target: 78, goal: 'lose' }).value).toBe(0)
  })
  it('one weigh-in only: the goal sets the direction', () => {
    expect(progressOf({ current: 81.4, start: 81.4, target: 78, goal: 'lose' })).toEqual({ value: 0, reached: false })
    expect(progressOf({ current: 77, start: 77, target: 78, goal: 'build' })).toEqual({ value: 0, reached: false })
    // the start is the target: a Lose goal is met at that weight and below
    expect(progressOf({ current: 78, start: 78, target: 78, goal: 'lose' })).toEqual({ value: 1, reached: true })
    expect(progressOf({ current: 78.5, start: 78, target: 78, goal: 'keep' })).toEqual({ value: 0, reached: false })
  })
  it('nothing to measure', () => {
    expect(progressOf({ current: null, start: null, target: 78, goal: 'lose' })).toEqual({ value: 0, reached: false })
    expect(progressOf({ current: 80, start: 80, target: null, goal: 'lose' })).toEqual({ value: 0, reached: false })
  })
})

describe('targetPreview', () => {
  const profile = { unit: 'kg', current: { weightKg: 81.4 } }
  it('the gap, and the weeks at the plan\'s pace', () => {
    expect(targetPreview({ text: '78', profile, targets: { weeklyChangeKg: -0.5 } })).toBe('3.4 kg to go from 81.4 kg. About 7 weeks at 0.5 kg a week.')
  })
  it('leaves the weeks out when they cannot be worked out', () => {
    expect(targetPreview({ text: '78', profile, targets: null })).toBe('3.4 kg to go from 81.4 kg.')
    expect(targetPreview({ text: '78', profile, targets: { weeklyChangeKg: 0.4 } })).toBe('3.4 kg to go from 81.4 kg.')
  })
  it('nothing for no number or no weigh-in', () => {
    expect(targetPreview({ text: '', profile, targets: null })).toBeNull()
    expect(targetPreview({ text: '78', profile: { unit: 'kg', current: null }, targets: null })).toBeNull()
  })
  it('the same weight as now', () => {
    expect(targetPreview({ text: '81.4', profile, targets: null })).toBe('That is your weight now (81.4 kg).')
  })
})
