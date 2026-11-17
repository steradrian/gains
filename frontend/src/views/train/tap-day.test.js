import { beforeEach, describe, expect, it, vi } from 'vitest'

const sheets = vi.hoisted(() => ({ openDay: vi.fn(), workoutDetailSheet: vi.fn() }))
vi.mock('../../sheets.jsx', () => sheets)

import { tapDay, tapWorkout } from './tap-day.js'

const TODAY = '2026-10-21'
const w = (id, d) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), entries: [] })

beforeEach(() => { vi.clearAllMocks() })

describe('tapDay (History\'s month, the load page\'s heatmap)', () => {
  it('a past day goes to openDay, whether it holds one workout, several or none', () => {
    const S = { workouts: [w('a', '2026-10-19'), w('b', '2026-10-20'), w('c', '2026-10-20')] }
    for (const iso of ['2026-10-19', '2026-10-20', '2026-10-18']) {
      tapDay(S, iso, TODAY)
      expect(sheets.openDay).toHaveBeenLastCalledWith(iso)
    }
    expect(sheets.openDay).toHaveBeenCalledTimes(3)
    expect(sheets.workoutDetailSheet).not.toHaveBeenCalled()
  })

  it('today with one workout opens that workout: the Day page is never today', () => {
    const only = w('t', TODAY)
    tapDay({ workouts: [only] }, TODAY, TODAY)
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith(only)
    expect(sheets.openDay).not.toHaveBeenCalled()
  })

  it('today with several workouts, or none, goes to openDay', () => {
    tapDay({ workouts: [w('t1', TODAY), w('t2', TODAY)] }, TODAY, TODAY)
    expect(sheets.openDay).toHaveBeenLastCalledWith(TODAY)
    tapDay({ workouts: [] }, TODAY, TODAY)
    expect(sheets.openDay).toHaveBeenCalledTimes(2)
    expect(sheets.workoutDetailSheet).not.toHaveBeenCalled()
  })
})

describe('tapWorkout (a row of History\'s list)', () => {
  it('a past workout opens its day', () => {
    tapWorkout(w('a', '2026-10-19'), TODAY)
    expect(sheets.openDay).toHaveBeenCalledWith('2026-10-19')
    expect(sheets.workoutDetailSheet).not.toHaveBeenCalled()
  })

  it('today\'s opens its detail', () => {
    const t = w('t', TODAY)
    tapWorkout(t, TODAY)
    expect(sheets.workoutDetailSheet).toHaveBeenCalledWith(t)
    expect(sheets.openDay).not.toHaveBeenCalled()
  })
})
