import { describe, expect, it } from 'vitest'
import { dayFiguresOf } from '../nutrition/trends.js'
import { TARGETS_DAYS, computeTargetsReached, targetDatesOf } from './targets-reached.js'

// S.targetsReached: the 14 closed days before today, judged by Eat's own dayFiguresOf (the fixtures
// are food-trends.test.js's). A day that cannot be judged is left out, never false.
const TODAY = '2026-10-18'
const entry = (date, kcal, protein = 0) => ({
  date, water: [], items: [{ uuid: 'i-' + date, meal: 0, name: 'Food', quantity: 1, nutrition: { calories: kcal, proteins: protein } }],
})
const settings = (calories = { sharedGoal: true, max: 2000 }, extra = {}) => ({
  calorieGoalMode: 'fixed', goals: { ...(calories ? { calories } : {}), proteins: { sharedGoal: true, max: 100 } }, ...extra,
})
const compute = (days, over = {}) => computeTargetsReached({ days, settings: settings(), today: TODAY, ...over })

describe('the window', () => {
  it('is the 14 days before today, oldest first, today not in it', () => {
    const dates = targetDatesOf(TODAY)
    expect(TARGETS_DAYS).toBe(14)
    expect(dates).toHaveLength(14)
    expect(dates[0]).toBe('2026-10-04')
    expect(dates.at(-1)).toBe('2026-10-17')
    expect(dates).not.toContain(TODAY)
  })

  it('leaves out today, still being logged, and anything older than 14 days', () => {
    const out = compute([entry(TODAY, 2000, 100), entry('2026-10-03', 2000, 100), entry('2026-10-17', 2000, 100)])
    expect(Object.keys(out)).toEqual(['2026-10-17'])
  })
})

describe('a day, as Eat judges it', () => {
  it('all is Eat\'s band: on within 150 kcal of the day\'s target, either way', () => {
    const days = [entry('2026-10-10', 1850, 100), entry('2026-10-11', 2150, 100), entry('2026-10-12', 2151, 100), entry('2026-10-13', 1849, 100)]
    const out = compute(days)
    expect(Object.fromEntries(Object.entries(out).map(([d, v]) => [d, v.all]))).toEqual({
      '2026-10-10': true, '2026-10-11': true, '2026-10-12': false, '2026-10-13': false,
    })
    for (const d of days) {
      const f = dayFiguresOf({ settings: settings(), entry: d, date: d.date })
      expect(out[d.date].all).toBe(f.band === 'on')
    }
  })

  it('protein is the protein target alone reached, whatever the calories did', () => {
    const out = compute([entry('2026-10-10', 3000, 100), entry('2026-10-11', 2000, 99), entry('2026-10-12', 2000, 140)])
    expect(out['2026-10-10']).toEqual({ all: false, protein: true })
    expect(out['2026-10-11']).toEqual({ all: true, protein: false })
    expect(out['2026-10-12']).toEqual({ all: true, protein: true })
  })

  it('a day with no food logged is omitted: unknown, not missed', () => {
    expect(compute([{ date: '2026-10-10', water: [], items: [] }])).toEqual({})
    expect(compute([])).toEqual({})
  })

  it('a day with no calorie goal is omitted, not false', () => {
    expect(computeTargetsReached({ days: [entry('2026-10-10', 2000, 100)], settings: settings(null), today: TODAY })).toEqual({})
  })

  it('a day with no protein goal is omitted, not false', () => {
    const noProtein = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: true, max: 2000 } } }
    const f = dayFiguresOf({ settings: noProtein, entry: entry('2026-10-10', 2000, 100), date: '2026-10-10' })
    const out = computeTargetsReached({ days: [entry('2026-10-10', 2000, 100)], settings: noProtein, today: TODAY })
    expect(out['2026-10-10'] === undefined).toBe(!(f.proteinTarget > 0))
  })
})

describe('while a target is still loading', () => {
  it('is null without settings, and null while a logged day\'s Dynamic burn is not in', () => {
    expect(computeTargetsReached({ days: [], settings: null, today: TODAY })).toBeNull()
    const dynamic = settings({ sharedGoal: true, max: 2000 }, { calorieGoalMode: 'dynamic', calorieGoalFactor: 1 })
    const days = [entry('2026-10-10', 2500, 100)]
    expect(computeTargetsReached({ days, settings: dynamic, today: TODAY })).toBeNull()
    const out = computeTargetsReached({ days, settings: dynamic, goalInputs: { '2026-10-10': 2500 }, today: TODAY })
    expect(out).toEqual({ '2026-10-10': { all: true, protein: true } })
  })
})
