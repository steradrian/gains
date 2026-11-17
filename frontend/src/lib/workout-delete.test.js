import { describe, expect, it } from 'vitest'
import { putBackWorkout, takeWorkout, takenMediaHashes } from './workout-delete.js'

const H = n => String(n).repeat(64).slice(0, 64)
const workout = (id, d, start, more = {}) => ({ id, d, start, end: start + 3600e3, name: id, entries: [], ...more })
const clone = v => JSON.parse(JSON.stringify(v))

describe('deleting a workout with an Undo (T8.4)', () => {
  it('takes the workout out and remembers the record and where it stood', () => {
    const s = { workouts: [workout('a', '2026-10-01', 1), workout('b', '2026-10-05', 2, { note: 'heavy' }), workout('c', '2026-10-09', 3)] }
    const snap = takeWorkout(s, { id: 'b' })
    expect(s.workouts.map(w => w.id)).toEqual(['a', 'c'])
    expect(snap.taken).toEqual([{ index: 1, rec: workout('b', '2026-10-05', 2, { note: 'heavy' }) }])
  })

  it('matches a record from before ids by its day and start, as the edits do', () => {
    const old = { d: '2026-09-01', start: 5, entries: [] }
    const s = { workouts: [workout('a', '2026-08-01', 1), clone(old)] }
    expect(takeWorkout(s, old).taken[0].index).toBe(1)
    expect(s.workouts.map(w => w.id)).toEqual(['a'])
  })

  it('is null when the workout is not there any more', () => {
    const s = { workouts: [workout('a', '2026-10-01', 1)] }
    expect(takeWorkout(s, { id: 'zz' })).toBeNull()
    expect(s.workouts).toHaveLength(1)
  })

  it('the Undo puts back the exact record at its index', () => {
    const before = [workout('a', '2026-10-01', 1), workout('b', '2026-10-05', 2, { media: [{ hash: H(1), mime: 'image/jpeg', size: 9 }] }), workout('c', '2026-10-09', 3)]
    const s = { workouts: clone(before) }
    const snap = takeWorkout(s, { id: 'b' })
    expect(putBackWorkout(s, snap)).toBe(true)
    expect(s.workouts).toEqual(before)
  })

  it('puts back nothing a sync already brought back, and lands at the end when the list got shorter', () => {
    const s = { workouts: [workout('a', '2026-10-01', 1), workout('b', '2026-10-05', 2)] }
    const snap = takeWorkout(s, { id: 'b' })
    const synced = { workouts: [workout('a', '2026-10-01', 1), workout('b', '2026-10-05', 2)] }
    expect(putBackWorkout(synced, snap)).toBe(false)
    expect(synced.workouts).toHaveLength(2)
    const shorter = { workouts: [] }
    expect(putBackWorkout(shorter, snap)).toBe(true)
    expect(shorter.workouts.map(w => w.id)).toEqual(['b'])
  })

  it('names every file and poster of the taken record, for the media hold', () => {
    const s = { workouts: [workout('a', '2026-10-01', 1, { media: [
      { hash: H(1), mime: 'image/jpeg', size: 9 },
      { hash: H(2), mime: 'video/mp4', size: 99, poster: { hash: H(3), mime: 'image/jpeg', size: 5 } },
    ] })] }
    expect(takenMediaHashes(takeWorkout(s, { id: 'a' })).sort()).toEqual([H(1), H(2), H(3)])
    expect(takenMediaHashes(null)).toEqual([])
  })
})
