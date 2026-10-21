// The plate line under a barbell set (workout-view.js plateLineFor), ported from
// views/Workout.plates.test.jsx (guard-M2a). The old screen drew one line per stack change under
// every row; the new screen shows one line for the set on screen (and the one being edited) and
// opens Plate loading (W1.25, exercise-drawers.test.jsx) from it.
import { describe, expect, it, vi } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { EXIDX } from '../../lib/exercises.js'
import { plateLineFor, plateLineForSet } from './workout-view.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const SQUAT = '0043' // barbell full squat
const DB_BENCH = '0289' // dumbbell bench press
const COCOONS = '0260' // body weight, done here with +25
const BAND_PULL = '0993' // band pull-apart
// One pair of each: the home gym the old file planned for.
const HOME = { 45: 1, 35: 1, 25: 1, 15: 1, 10: 1, 5: 1, 2.5: 1 }

const entry = (id, w, target = {}) => ({ id, target: { sets: 1, reps: 6, w, ...target }, sets: [{ w, r: 6, done: false }] })
const state = (patch = {}) => Object.assign(clone(DEF), { unit: 'lb', plates: { lb: HOME } }, patch)
const line = (id, w, { S = state(), target } = {}) => plateLineFor(S, entry(id, w, target), w)

describe('the plate line', () => {
  it('the exercises used here are what the test assumes', () => {
    expect(EXIDX[SQUAT].eq).toBe('barbell')
    expect(EXIDX[DB_BENCH].eq).toBe('dumbbell')
    expect(EXIDX[COCOONS].eq).toBe('body weight')
    expect(EXIDX[BAND_PULL].eq).toBe('band')
  })

  // old :91 (the squat ramp, one line per row), now one line per set on screen
  it('names the bar and the plates each side for the set on screen', () => {
    expect(line(SQUAT, 70)).toBe('Bar 45 lb + 10 + 2.5 each side')
    expect(line(SQUAT, 120)).toBe('Bar 45 lb + 35 + 2.5 each side')
    expect(line(SQUAT, 145)).toBe('Bar 45 lb + 45 + 5 each side')
  })

  // old :103
  it('the empty bar is the bar alone; the first plates after it are all adds', () => {
    expect(line(SQUAT, 45)).toBe('Bar 45 lb')
    expect(line(SQUAT, 95)).toBe('Bar 45 lb + 25 each side')
  })

  // old :117
  it('"no bar" (an explicit 0) loads the whole total', () => {
    const S = state({ barWeights: { [SQUAT]: 0 } })
    expect(line(SQUAT, 90, { S })).toContain('45 each side')
  })

  // old :86 and :122
  it('a band and a dumbbell have no plates', () => {
    expect(line(BAND_PULL, 10)).toBeNull()
    expect(line(DB_BENCH, 25)).toBeNull()
  })

  it('turns off with the Plate loading setting', () => {
    expect(line(SQUAT, 145, { S: state({ showPlates: false }) })).toBeNull()
  })

  // old :122 (body weight with added weight is one stack, "Load 25")
  it('a body-weight exercise with added weight is one stack, "Load 25"', () => {
    expect(line(COCOONS, 25)).toBe('Load 25')
  })

  it('a body-weight exercise without added weight has no line', () => {
    expect(line(COCOONS, 0)).toBeNull()
  })

  // old :111, :148 (the short note): ported in exercise-drawers.extra.test.jsx, on the Plate loading drawer

  // old :179: the Plate loading row reads Per side for a machine, and the line follows
  it('a machine loaded per side with its own weight never says Bar', () => {
    const MACHINE = Object.values(EXIDX).find(e => e.eq === 'leverage machine').id
    const S = state({ loadKind: { [MACHINE]: { kind: 'pairs', _ts: 1 } }, barWeights: { [MACHINE]: 50 } })
    const text = line(MACHINE, 145, { S })
    expect(text).toBe('45 + 2.5 per side')
    expect(text).not.toContain('Bar')
  })
})

// The line for a logged row (plateLineForSet): per-side rows and the editor.
describe('the plate line for a row', () => {
  const LUNGE = '0054' // barbell lunge, the coach runs it per side
  const side = (L, R) => ({ w: Math.max(L, R), r: 16, done: false, sides: { L: { w: L, r: 8, done: false }, R: { w: R, r: 8, done: false } } })
  const lunge = sets => ({ id: LUNGE, target: { sets: sets.length, reps: 8, w: 65, side: true }, sets })
  const forRow = (s, opts) => plateLineForSet(state(), lunge([s]), s, opts)

  // old :70: both legs share the bar
  it('a per-side bar exercise loads from the sides\' shared bar', () => {
    expect(forRow(side(65, 65))).toBe('Bar 45 lb + 10 each side')
  })

  it('uses the side that has a number while the other has none yet', () => {
    expect(forRow(side(65, 0))).toBe('Bar 45 lb + 10 each side')
  })

  // old :80
  it('sides carrying different weights get no line, not the heavier one\'s', () => {
    expect(forRow(side(65, 75))).toBeNull()
  })

  it('a plain row loads its own weight', () => {
    expect(forRow({ w: 145, r: 6, done: false })).toBe('Bar 45 lb + 45 + 5 each side')
    expect(forRow({ w: 0, r: 6, done: false })).toBeNull()
  })

  // old :197 (#203)
  it('a saved workout being corrected has no plate line', () => {
    expect(forRow({ w: 145, r: 6, done: false }, { editing: true })).toBeNull()
  })
})
