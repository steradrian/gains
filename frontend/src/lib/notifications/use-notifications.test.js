// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { dayOnTargetOf } from './use-notifications.js'

const fixed = { calorieGoalMode: 'fixed', goals: { calories: { max: 2200 } } }
const days = [{ date: '2026-10-12', kcal: 2100 }, { date: '2026-10-13', kcal: 2500 }]

describe('dayOnTargetOf: days on target for the weekly recap', () => {
  it('a logged day at or under its fixed target is on target; over it, or not logged, is not', () => {
    const { dayOnTarget } = dayOnTargetOf(fixed, days, true)
    expect(dayOnTarget('2026-10-12')).toBe(true)
    expect(dayOnTarget('2026-10-13')).toBe(false)
    expect(dayOnTarget('2026-10-14')).toBe(false)
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
