import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as onerm from '../../../lib/onerm.js'
import { loggedLine } from './exercise-lines.js'

vi.mock('../../../lib/onerm.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, best1RM: vi.fn(actual.best1RM) }
})

const BENCH = { id: '0025' }
const SQUAT = { id: '0043' }
const workout = (id, exId, w) => ({ id, d: '2026-09-15', start: Date.UTC(2026, 8, 15, 17), unit: 'kg', entries: [{ id: exId, target: { mode: 'reps' }, sets: [{ w, r: 5, done: true }] }] })
const state = over => ({ unit: 'kg', workouts: [workout('a', '0025', 80), workout('b', '0043', 100)], ...over })

beforeEach(() => { onerm.best1RM.mockClear() })

describe('loggedLine', () => {
  it('says the best set and the estimate', () => {
    expect(loggedLine(state(), BENCH)).toMatch(/^Best 80 kg × 5 · est\. 1RM \d+ kg$/)
  })

  it('reads an exercise once per log: a re-render with the same log does not rescan it', () => {
    const S = state()
    loggedLine(S, BENCH)
    loggedLine(S, SQUAT)
    expect(onerm.best1RM).toHaveBeenCalledTimes(2)
    loggedLine(S, BENCH)
    loggedLine(S, SQUAT)
    loggedLine({ ...S }, BENCH)
    expect(onerm.best1RM).toHaveBeenCalledTimes(2)
  })

  it('reads again when the log, the unit or the formula changes', () => {
    const S = state()
    const first = loggedLine(S, BENCH)
    onerm.best1RM.mockClear()
    const heavier = state({ workouts: [workout('a', '0025', 90)] })
    expect(loggedLine(heavier, BENCH)).not.toBe(first)
    expect(onerm.best1RM).toHaveBeenCalledTimes(1)
    loggedLine({ ...heavier, unit: 'lb' }, BENCH)
    expect(onerm.best1RM).toHaveBeenCalledTimes(2)
    loggedLine({ ...heavier, unit: 'lb', oneRmFormula: 'brzycki' }, BENCH)
    expect(onerm.best1RM).toHaveBeenCalledTimes(3)
  })
})
