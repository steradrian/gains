import { describe, expect, it } from 'vitest'
import { activityTracked, foodTracked, trainingTracked } from './food-tracked.js'

describe('what the person tracks', () => {
  it('is on for a profile saved before the switches existed, and for an unset state', () => {
    for (const S of [{}, undefined, null]) {
      expect(foodTracked(S)).toBe(true)
      expect(trainingTracked(S)).toBe(true)
      expect(activityTracked(S)).toBe(true)
    }
  })

  it('is off only for an explicit false, and each switch is its own key', () => {
    expect(foodTracked({ trackFood: false })).toBe(false)
    expect(trainingTracked({ trackFood: false })).toBe(true)
    expect(trainingTracked({ trackTraining: false })).toBe(false)
    expect(activityTracked({ trackActivity: false })).toBe(false)
    expect(foodTracked({ trackFood: 0 })).toBe(true)
  })
})
