import { describe, expect, it } from 'vitest'
import { HevyApiError } from '../../../lib/import-hevy.js'
import { hevyFetchError, hevyFraction, hevyProgressLabel } from './import-progress.js'

describe('Hevy import progress', () => {
  it('runs from 0 to 1 across the five stages', () => {
    expect(hevyFraction(null)).toBe(0)
    expect(hevyFraction({ stage: 'templates', page: 1, pageCount: 2 })).toBeCloseTo(0.1)
    expect(hevyFraction({ stage: 'workouts', page: 3, pageCount: 3 })).toBeCloseTo(0.4)
    expect(hevyFraction({ stage: 'parse' })).toBeCloseTo(0.8)
  })

  it('names the stage and the page', () => {
    expect(hevyProgressLabel({ stage: 'workouts', page: 2, pageCount: 5 })).toBe('Fetching workouts… (2/5)')
    expect(hevyProgressLabel({ stage: 'parse' })).toBe('Matching exercises…')
  })

  it('says why a fetch failed', () => {
    expect(hevyFetchError(new HevyApiError(401, 'auth'))).toBe('That Hevy API key was refused')
    expect(hevyFetchError(new HevyApiError(429, 'rate-limit'))).toMatch(/rate-limiting/)
    expect(hevyFetchError(new Error('x'))).toMatch(/Couldn’t reach Hevy/)
  })
})
