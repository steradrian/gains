// @vitest-environment happy-dom
// The running screen's set lines (review findings 5, 6 and 12): a timed per-side hold is one set
// with a Left and a Right, a pyramid's Max set says so with its record, and the all-done clock
// reads h:mm:ss past an hour. Built through the view model, the way WorkoutScreen reads it.
import { describe, expect, it } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { buildWorkoutView, extendWorkoutView } from './workout-view.js'
import { PAST_BENCH, clone, lift, stretch } from './test-fixtures.js'

const NOW = Date.parse('2026-10-21T12:00:00')

function viewOf(entries, { cur = 0, workouts = [], start = NOW - 60_000, over = {} } = {}) {
  const S = { ...clone(DEF), unit: 'kg', workouts: clone(workouts) }
  const A = { id: 'a', d: '2026-10-21', start, name: 'Test', bw: null, cur, entries: clone(entries), ...over }
  S.active = A
  return extendWorkoutView(buildWorkoutView({ S, A, now: NOW }), { S, A })
}

describe('a timed per-side stretch', () => {
  const entries = () => [lift('0025', 80, 8, 1), stretch()]

  it('reads one set with Left, then Right, never "Set 2 of 2"', () => {
    const left = viewOf(entries(), { cur: 1 })
    expect(left.current.setLine).toBe('Set 1 of 1 · Left')
    expect(left.hero.dots).toEqual(['now'])

    const E = entries()
    E[1].sets[0].done = true
    const right = viewOf(E, { cur: 1 })
    expect(right.current.setLine).toBe('Set 1 of 1 · Right')
    expect(right.hero.dots).toEqual(['now'])
  })

  it('counts a pair as one set among several', () => {
    const E = entries()
    E[1].sets.push({ sec: 30, w: 0, side: 'L', done: false }, { sec: 30, w: 0, side: 'R', done: false })
    E[1].sets[0].done = true
    E[1].sets[1].done = true
    const view = viewOf(E, { cur: 1 })
    expect(view.current.setLine).toBe('Set 2 of 2 · Left')
    expect(view.hero.dots).toEqual(['done', 'now'])
  })
})

describe('a pyramid Max set', () => {
  const pyramid = () => ({
    ...lift('0025', 60, 12, 2),
    sets: [{ w: 60, r: 12, done: true }, { w: 60, r: 0, done: false, max: true }],
  })
  const past = {
    ...PAST_BENCH,
    entries: [{ id: '0025', target: { sets: 1, reps: 12, weight: 60 }, sets: [{ w: 60, r: 14, done: true, max: true }] }],
  }

  it('says Max on the set line and shows the record to beat', () => {
    const { current } = viewOf([pyramid()], { workouts: [past] })
    expect(current.setLine).toBe('Set 2 of 2 · Max')
    expect(current.maxLine).toBe('Max: as many reps as you can · Record: 14 reps at 60 kg')
  })

  it('has no record line yet on a first Max set, and none on a plain set', () => {
    expect(viewOf([pyramid()]).current.maxLine).toBe('Max: as many reps as you can')
    expect(viewOf([lift('0025', 60, 12, 2)]).current.maxLine).toBeNull()
  })
})

describe('the all-done clock', () => {
  const finished = () => {
    const e = lift('0025', 80, 8, 1)
    e.sets[0].done = true
    return [e]
  }

  it('reads minutes and seconds under an hour', () => {
    expect(viewOf(finished(), { start: NOW - (51 * 60 + 40) * 1000 }).allDone.line).toContain('51:40')
  })

  it('reads h:mm:ss from an hour, like the Finish drawer', () => {
    const line = viewOf(finished(), { start: NOW - (93 * 60 + 12) * 1000 }).allDone.line
    expect(line).toContain('1:33:12')
    expect(line).not.toContain('93:12')
  })
})
