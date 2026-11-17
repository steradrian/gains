import { describe, expect, it } from 'vitest'
import { FATIGUE_READY_BELOW, fatigueHalfLifeOf, fatigueOf, fatigueReadyAt } from './recovery.js'
import { fatigueStateOf } from './recovery-view.js'

const NOW = Date.UTC(2026, 9, 12, 18)
const HOUR = 3600000
const set = () => ({ done: true, w: 80, r: 8, unit: 'kg', rir: 0 })
const session = (start, n) => ({ id: 's' + start, d: new Date(start).toISOString().slice(0, 10), start, unit: 'kg', entries: [{ id: '0025', sets: Array.from({ length: n }, set) }] })

describe('fatigueReadyAt', () => {
  it('is null for a muscle that is ready already, or for no number', () => {
    expect(fatigueReadyAt(0, 'chest', NOW)).toBeNull()
    expect(fatigueReadyAt(FATIGUE_READY_BELOW - 0.01, 'chest', NOW)).toBeNull()
    expect(fatigueReadyAt(undefined, 'chest', NOW)).toBeNull()
    expect(fatigueReadyAt(0.6, 'chest', NaN)).toBeNull()
  })

  it('is now at the boundary, and one half-life later for a value whose raw load is twice the boundary', () => {
    expect(fatigueReadyAt(FATIGUE_READY_BELOW, 'chest', NOW)).toBe(NOW)
    const twice = 1 - Math.exp(2 * Math.log(1 - FATIGUE_READY_BELOW))
    expect(fatigueReadyAt(twice, 'chest', NOW)).toBeCloseTo(NOW + fatigueHalfLifeOf('chest'), -1)
  })

  it('waits longer for legs than for arms at the same fatigue (their half-lives)', () => {
    expect(fatigueReadyAt(0.8, 'quadriceps', NOW) - NOW).toBeGreaterThan(fatigueReadyAt(0.8, 'biceps', NOW) - NOW)
  })

  it('matches fatigueOf: fatigued until the projected time, ready just after it', () => {
    const workouts = [session(NOW - 2 * HOUR, 8)]
    const value = fatigueOf(workouts, NOW).chest
    expect(fatigueStateOf(value)).not.toBe('ready')
    const at = fatigueReadyAt(value, 'chest', NOW)
    expect(at).toBeGreaterThan(NOW)
    expect(fatigueStateOf(fatigueOf(workouts, at - 60000).chest)).not.toBe('ready')
    expect(fatigueStateOf(fatigueOf(workouts, at + 60000).chest)).toBe('ready')
  })

  it('never returns Infinity for a saturated muscle', () => {
    expect(Number.isFinite(fatigueReadyAt(1, 'chest', NOW))).toBe(true)
  })
})
