import { describe, expect, it } from 'vitest'
import { strengthExerciseRows, strengthLiftRows } from './strength-exercises.js'

const DAY = 86400000
const NOW = Date.UTC(2026, 9, 12, 12)
const workout = (id, start, exId, sets) => ({ id, d: new Date(start).toISOString().slice(0, 10), start, unit: 'kg', entries: [{ id: exId, sets }] })
const work = w => ({ done: true, w, r: 5, unit: 'kg' })

describe('strengthLiftRows', () => {
  it('keeps every strength row, in the same order, with when its last work set was done', () => {
    const S = { unit: 'kg', workouts: [
      workout('a', NOW - 2 * DAY, '0025', [work(80)]),
      workout('b', NOW - 40 * DAY, '0043', [work(120)]),
    ] }
    const rows = strengthLiftRows(S, NOW)
    expect(rows.map(r => r.id)).toEqual(strengthExerciseRows(S, NOW).map(r => r.id))
    const bench = rows.find(r => r.id === '0025')
    expect(bench.lastAt).toBe(NOW - 2 * DAY)
    expect(bench.losing).toBe(false)
    const squat = rows.find(r => r.id === '0043')
    expect(squat.lastAt).toBe(NOW - 40 * DAY)
    expect(squat.losing).toBe(true)
    expect(squat.decay).toBeLessThan(1)
  })

  it('leaves warm-ups out of the last work set', () => {
    const S = { unit: 'kg', workouts: [
      workout('old', NOW - 30 * DAY, '0025', [work(80)]),
      workout('warm', NOW - DAY, '0025', [{ ...work(40), warmup: true }]),
    ] }
    expect(strengthLiftRows(S, NOW).find(r => r.id === '0025').lastAt).toBe(NOW - 30 * DAY)
  })

  it('is empty with nothing to estimate from', () => {
    expect(strengthLiftRows({ unit: 'kg', workouts: [] }, NOW)).toEqual([])
  })
})
