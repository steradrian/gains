// Effort ratings and moves, ported from views/Workout.test.jsx:2728-3018 (guard-M2a).
// The old screen ticked a set when its effort was picked. On the new screen the tick is the Done
// button and the effort chips belong to the set just done (WorkoutScreen.flow.test.jsx 'effort chips
// under the hero'), so what is left to prove here is that rating never changes the tick.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setEffortAt, setSideFieldAt } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const row = (extra = {}) => ({ w: 60, r: 5, done: false, ...extra })

function seed(entries, over = {}) {
  const S = clone(DEF)
  Object.assign(S, { effort: 'rir', ...over })
  S.active = { id: 'act', d: '2026-10-22', start: Date.now(), name: 'Push A', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const sets = () => useStore.getState().S.active.entries[0].sets

beforeEach(() => { useUI.setState({ timer: null, work: null, toastMsg: null, toastAction: null, setFlash: null }) })
afterEach(() => { useStore.setState({ S: clone(DEF) }) })

describe('effort rating leaves the tick alone', () => {
  // old :2957
  it('rating a set that is already done leaves it done, and starts no rest', () => {
    seed([{ id: 'x', target: { sets: 2 }, sets: [row({ done: true }), row()] }])
    setEffortAt(0, 0, 'rir', 1)
    expect(sets()[0]).toMatchObject({ rir: 1, done: true })
    expect(useUI.getState().timer).toBeNull()
  })

  // old :2969
  it('clearing a rating drops the key and never un-ticks the set', () => {
    seed([{ id: 'x', target: { sets: 2 }, sets: [row({ done: true, rir: 3 }), row()] }])
    setEffortAt(0, 0, 'rir', null)
    expect('rir' in sets()[0]).toBe(false)
    expect(sets()[0].done).toBe(true)
  })

  // old :2983 (rir and rpe): a side rated alone completes nothing
  it.each([['rir', 2], ['rpe', 8]])('rating one side by %s completes neither side nor the set, and clearing it keeps the side as it was', (field, value) => {
    const side = () => ({ w: 20, r: 8, done: false })
    seed([{ id: 'x', target: { sets: 1, side: true }, sets: [{ w: 20, r: 16, done: false, sides: { L: side(), R: side() } }] }], { effort: field })
    setSideFieldAt(0, 0, 'L', field, value)
    expect(sets()[0].sides.L[field]).toBe(value)
    expect(sets()[0].sides.L.done).toBe(false)
    expect(sets()[0].sides.R.done).toBe(false)
    expect(sets()[0].done).toBe(false)
    setSideFieldAt(0, 0, 'L', field, null)
    expect(sets()[0].sides.L[field]).toBeUndefined()
  })
})

// Gaps found while porting :2728-2934. Each is behaviour the old More menu had and the new
// map or actions do not.
describe('moves (gaps)', () => {
  // old :2772: Move down on a superset member swapped it inside the superset (#377).
  // moveEntryWithinPart / the map reorder move the whole unit only.
  it.todo('moves a superset member inside its superset (old Workout.test.jsx:2772)')
  // old :2819: moveEntryWithinPart does not touch useUI.timer.forIdx, setEntryPart does.
  it.todo('a whole-superset move during a rest hands the rest to the resting exercise\'s new place (old :2819)')
  it.todo('a member swap during a rest hands the rest to the moved exercise\'s new place (old :2801)')
  // old :2834: the hook keeps progressHighWater by index; moveEntryWithinPart does not re-index it.
  it.todo('a member swap keeps each exercise\'s counted sets with it, so its next tick still counts (old :2834)')
})
