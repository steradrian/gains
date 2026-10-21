import { describe, expect, it } from 'vitest'
import { bestSetLabel } from './best-set.js'
import { EXIDX } from './exercises.js'

// The Best set tile shows the load big and the reps under it (Train review #35): every kind of set
// carries its unit in the big half, so nobody splits the label to find it.
const BARBELL_BENCH = '0025'
const DB_BENCH = '0289' // dumbbell bench press: two bells
const PULLUP = '0652' // pull-up, body weight

const S = (id, sets, target = {}) => ({
  unit: 'kg', routines: [], exWeights: {},
  workouts: [{
    id: 'w1', d: '2026-10-01', start: Date.parse('2026-10-01T10:00:00'),
    entries: [{ id, target: { id, sets: sets.length, reps: 8, mode: 'reps', ...target }, sets: sets.map(([w, r]) => ({ w, r, done: true })) }],
  }],
})
const parts = (id, sets, target) => {
  const best = bestSetLabel(S(id, sets, target), EXIDX[id])
  return [best.value, best.rest]
}

describe('bestSetLabel parts', () => {
  it('reads a loaded set as its weight with the unit, and the reps under it', () => {
    expect(parts(BARBELL_BENCH, [[80, 5], [82.5, 6]])).toEqual(['82.5 kg', '× 6'])
    expect(bestSetLabel(S(BARBELL_BENCH, [[82.5, 6]]), EXIDX[BARBELL_BENCH]).label).toBe('82.5 kg × 6')
  })

  it('reads a belt on a bodyweight lift as "+10 kg"', () => {
    expect(parts(PULLUP, [[10, 8]])).toEqual(['+10 kg', '× 8'])
  })

  it('reads an unloaded set as its reps, with "reps" under it', () => {
    expect(parts(PULLUP, [[0, 12]])).toEqual(['12', 'reps'])
  })

  it('reads a per-hand dumbbell weight as "20 kg each"', () => {
    expect(parts(DB_BENCH, [[20, 8]], { dbLoad: 'each' })).toEqual(['20 kg each', '× 8'])
  })

  it('keeps a timed or cardio set whole', () => {
    const plank = { ...S('plank', []), workouts: [{ id: 'p', d: '2026-10-01', start: 1, entries: [{ id: 'plank', target: { id: 'plank', mode: 'time' }, sets: [{ sec: 90, done: true }] }] }] }
    const best = bestSetLabel(plank, { id: 'plank' })
    expect(best.value).toBe(best.label)
    expect(best.rest).toBeNull()
  })
})
