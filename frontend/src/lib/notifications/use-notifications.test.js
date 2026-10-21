// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { dayOnTargetOf } from './use-notifications.js'

const fixed = { calorieGoalMode: 'fixed', goals: { calories: { max: 2200 } } }
const days = [{ date: '2026-10-12', kcal: 2100 }, { date: '2026-10-13', kcal: 2500 }]

describe('dayOnTargetOf: days on target for the weekly recap', () => {
  it('a logged day at or under its fixed target is on target; over it is not', () => {
    const { dayOnTarget } = dayOnTargetOf(fixed, days, true)
    expect(dayOnTarget('2026-10-12')).toBe(true)
    expect(dayOnTarget('2026-10-13')).toBe(false)
  })

  it('a day with nothing logged is not known, not off target', () => {
    const { dayOnTarget } = dayOnTargetOf(fixed, [...days, { date: '2026-10-15', kcal: 0 }], true)
    expect(dayOnTarget('2026-10-14')).toBeNull()
    expect(dayOnTarget('2026-10-15')).toBeNull()
  })

  it('holds each day to that day\'s own goal, a weekday split included', () => {
    // Monday 12 Oct's goal is 2000 (2100 eaten: over), Tuesday 13 Oct's 2600 (2500 eaten: on).
    const split = { calorieGoalMode: 'fixed', goals: { calories: { sharedGoal: false, max: 2200, days: [2200, 2000, 2600, 2200, 2200, 2200, 2200] } } }
    const { dayOnTarget } = dayOnTargetOf(split, days, true)
    expect(dayOnTarget('2026-10-12')).toBe(false)
    expect(dayOnTarget('2026-10-13')).toBe(true)
  })

  it('without a calorie goal the person set, no day is judged (the diary\'s 2000 kcal is a stand-in)', () => {
    const { dayOnTarget } = dayOnTargetOf({ calorieGoalMode: 'fixed', goals: {} }, days, true)
    expect(dayOnTarget('2026-10-12')).toBeNull()
  })

  it('cannot say before the diary index has caught up, or without settings', () => {
    expect(dayOnTargetOf(fixed, days, false)).toBeNull()
    expect(dayOnTargetOf(null, days, true)).toBeNull()
  })

  it('cannot say for a target it cannot read back for a past day', () => {
    expect(dayOnTargetOf({ ...fixed, calorieGoalMode: 'adaptive' }, days, true)).toBeNull()
    expect(dayOnTargetOf({ ...fixed, calorieGoalMode: 'dynamic' }, days, true)).toBeNull()
    expect(dayOnTargetOf({ ...fixed, diaryShowActivity: true, calorieAdjustFromActivity: true }, days, true)).toBeNull()
  })
})
