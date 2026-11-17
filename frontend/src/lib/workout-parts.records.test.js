// @vitest-environment happy-dom
// Saved warm-up and cool-down entries never hold a record or seed the next session
// (lib/workout-parts.js countsForRecords), in every pass over saved history.
import { describe, expect, it } from 'vitest'
import { DEF } from '../store/useStore.js'
import { bestWeightFor, lastEntryFor } from './history.js'
import { rebuildPrHistory } from './workout-date.js'

const FACE_PULL = '0300'
const clone = v => JSON.parse(JSON.stringify(v))
const entry = (w, part, over = {}) => ({
  id: FACE_PULL, ...(part ? { part } : {}), target: { sets: 1, reps: 10, weight: w }, sets: [{ w, r: 10, done: true }], ...over,
})
const workout = (id, d, entries, over = {}) => ({ id, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T11:00:00'), routineIds: [], name: 'W', entries, prs: [], ...over })
const state = workouts => ({ ...clone(DEF), workouts })

describe('rebuildPrHistory', () => {
  it('gives a warm-up exercise no badge, and revokes one it carried', () => {
    const warm = workout('a', '2026-10-01', [entry(25, 'warmup')], { prs: [FACE_PULL] })
    const [out] = rebuildPrHistory([warm], [FACE_PULL], warm)
    expect(out.prs).toEqual([])
  })

  it('lets the working entry hold the badge when the exercise is in both parts', () => {
    const both = workout('a', '2026-10-01', [entry(40, 'warmup'), entry(20)])
    const [out] = rebuildPrHistory([both], [FACE_PULL], both)
    expect(out.prs).toEqual([FACE_PULL])
  })
})

describe('bestWeightFor', () => {
  it('ignores warm-up and cool-down entries', () => {
    const S = state([workout('a', '2026-10-01', [entry(40, 'warmup'), entry(30, 'cooldown'), entry(20)])])
    expect(bestWeightFor(S, FACE_PULL)).toBe(20)
    expect(bestWeightFor(state([workout('b', '2026-10-02', [entry(40, 'warmup')])]), FACE_PULL)).toBe(0)
  })
})

describe('lastEntryFor', () => {
  const S = state([
    workout('a', '2026-10-01', [entry(20)]),
    workout('b', '2026-10-08', [entry(40, 'warmup')]),
  ])

  it('reads the working entry, not a later warm-up of the same exercise', () => {
    expect(lastEntryFor(S, FACE_PULL).sets[0].w).toBe(20)
  })

  it('reads a warm-up entry for a warm-up', () => {
    expect(lastEntryFor(S, FACE_PULL, undefined, 'warmup').sets[0].w).toBe(40)
  })
})
