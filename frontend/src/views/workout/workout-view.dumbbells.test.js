// Dumbbells on the running workout (guard-M2a), ported from Workout.dumbbells.test.jsx: what the weight
// field is called, and + and − walking bell to bell when the dumbbells you own are listed (#376).
// `setFields` (workout-view.js) is the new screen's field model; `stepFieldAt` (workout-actions.js)
// is the tap. The old "Each (kg)" / "Both (kg)" column heads are the todo below.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { EXIDX } from '../../lib/exercises.js'
import { setFields } from './workout-view.js'
import { stepFieldAt } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0289' // dumbbell bench press
const ROW = '0292' // dumbbell one arm bent-over row
const work = w => ({ w, r: 8, done: false })
const entry = (id, sets, target = {}) => ({ id, target: { sets: sets.length, reps: 8, mode: 'reps', ...target }, sets })

function seed(entries, patch = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', ...patch })
  S.active = { id: 'db-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Dumbbells', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
  return useStore.getState().S
}
const A = () => useStore.getState().S.active
const weightField = (idx = 0) => setFields(useStore.getState().S, A().entries[idx], 0).fields.find(f => f.f === 'w')

beforeEach(() => { useUI.setState({ timer: null, work: null, toastMsg: null, toastAction: null }) })
afterEach(() => { useStore.setState({ S: clone(DEF) }) })

describe('dumbbell weight field', () => {
  it('the exercises used here are what the test assumes', () => {
    expect(EXIDX[BENCH].eq).toBe('dumbbell')
    expect(EXIDX[ROW].n).toMatch(/one arm/)
  })

  it('stays the plain weight (the unit, "Weight" in the drawer) as entered and for one-arm work', () => {
    seed([entry(BENCH, [work(20)]), entry(ROW, [work(30)], { dbLoad: 'each' })])
    expect(weightField(0).label).toBe('kg')
    expect(weightField(1).label).toBe('kg')
  })

  it.todo('names the meaning the session logs in: "Each (kg)" for dbLoad each, "Both (kg)" for total [old Workout.dumbbells.test.jsx:60; setFields labels every rep-lift weight with the unit only]')
})

describe('stepper over owned dumbbells', () => {
  const RACK = [3, 6, 8, 9, 11, 13, 15, 17, 18, 19, 21, 24]
  const tap = dir => {
    const f = weightField()
    stepFieldAt(0, 0, f, dir, { weight: true, owned: f.owned })
  }
  const w = () => A().entries[0].sets[0].w

  it('walks the bells you own', () => {
    seed([entry('0294', [work(9)], { inc: 2 })], { dumbbells: { kg: { weights: RACK, _ts: 1 } } })
    expect(weightField().owned).toEqual(RACK)
    tap(1)
    expect(w()).toBe(11)
    tap(1)
    expect(w()).toBe(13)
    tap(-1)
    tap(-1)
    tap(-1)
    expect(w()).toBe(8)
  })

  it('keeps the increment without a list', () => {
    seed([entry('0294', [work(9)], { inc: 2 })])
    expect(weightField().owned).toBeNull()
    expect(weightField().step).toBe(2)
    tap(1)
    expect(w()).toBe(11)
    tap(1)
    expect(w()).toBe(13)
    tap(-1)
    expect(w()).toBe(11)
    // From an even weight the grid takes over again: 10 + 2 = 12, which no rack above holds.
    useStore.getState().update(s => { s.active.entries[0].sets[0].w = 10 })
    tap(1)
    expect(w()).toBe(12)
  })
})
