// Effort ratings and moves, ported from views/Workout.test.jsx:2728-3018 (guard-M2a).
// The old screen ticked a set when its effort was picked. On the new screen the tick is the Done
// button and the effort chips belong to the set just done (WorkoutScreen.flow.test.jsx 'effort chips
// under the hero'), so what is left to prove here is that rating never changes the tick.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { holdRow, moveEntryWithinPart, onEntriesReordered, setEffortAt, setHoldRow, setSideFieldAt } from './workout-actions.js'

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

// The map's reorder (MapDrawer onReorder -> moveEntryWithinPart), ported from :2772, :2801, :2819,
// :2834 (guard-M2d).
describe('moves', () => {
  const ex = (id, dones, extra = {}) => ({ id, target: { sets: dones.length }, sets: dones.map(done => row({ done })), ...extra })
  const ids = () => useStore.getState().S.active.entries.map(e => e.id)
  const cursorAt = cur => useStore.getState().update(s => { s.active.cur = cur })
  const restFor = forIdx => ({ left: 60, total: 60, endsAt: Date.now() + 60_000, forIdx, kind: 'set' })
  const superset = () => [
    ex('bench', [true]),
    ex('pull-up', [true, false], { sg: 'm' }),
    ex('leg-raise', [true, false], { sg: 'm' }),
    ex('plank', [false, false], { sg: 'm' }),
  ]

  // old :2772
  it('moves a superset member inside its superset', () => {
    seed(superset())
    cursorAt(1)
    expect(moveEntryWithinPart(2, 3)).toBe(3)
    expect(ids()).toEqual(['bench', 'pull-up', 'plank', 'leg-raise'])
    expect(useStore.getState().S.active.entries.slice(1).map(e => e.sg)).toEqual(['m', 'm', 'm'])
    expect(useStore.getState().S.active.cur).toBe(1)
  })

  it('moves a member several places inside its superset, and a member at the edge takes the whole superset on', () => {
    seed(superset())
    expect(moveEntryWithinPart(1, 3)).toBe(3)
    expect(ids()).toEqual(['bench', 'leg-raise', 'plank', 'pull-up'])
    seed([...superset(), ex('row', [false])])
    expect(moveEntryWithinPart(3, 4)).toBe(4)
    expect(ids()).toEqual(['bench', 'row', 'pull-up', 'leg-raise', 'plank'])
  })

  // old :2801
  it('a member swap during a rest hands the rest to the moved exercise\'s new place', () => {
    seed(superset())
    useUI.setState({ timer: restFor(2) })
    moveEntryWithinPart(2, 3)
    expect(ids()[3]).toBe('leg-raise')
    expect(useUI.getState().timer.forIdx).toBe(3)
    expect(useUI.getState().timer.endsAt).toBeGreaterThan(Date.now())
  })

  // old :2819
  it('a whole-superset move during a rest hands the rest to the resting exercise\'s new place', () => {
    seed([
      ex('bench', [true, false]),
      ex('pull-up', [false], { sg: 'm' }),
      ex('leg-raise', [false], { sg: 'm' }),
    ])
    cursorAt(1)
    useUI.setState({ timer: restFor(0) })
    moveEntryWithinPart(1, 0)
    expect(ids()).toEqual(['pull-up', 'leg-raise', 'bench'])
    expect(useUI.getState().timer.forIdx).toBe(2)
  })

  it('leaves a rest alone when its exercise did not change place', () => {
    seed([ex('a', [true]), ex('b', [false]), ex('c', [false])])
    useUI.setState({ timer: restFor(0) })
    moveEntryWithinPart(2, 1)
    expect(useUI.getState().timer.forIdx).toBe(0)
  })

  // old :2834: the hook's counts of ticked sets are told the permutation (new position -> old index)
  it('tells the hook\'s counted sets how the entries moved', () => {
    seed(superset())
    const heard = vi.fn()
    const off = onEntriesReordered(heard)
    moveEntryWithinPart(2, 3)
    off()
    moveEntryWithinPart(3, 2)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(heard).toHaveBeenCalledWith([0, 1, 3, 2])
  })

  it('moves the running hold with its exercise', () => {
    seed([ex('a', [false]), ex('b', [false])])
    setHoldRow({ owner: { idx: 0, i: 0 }, idx: 0, i: 0 })
    useUI.setState({ work: { left: 30, total: 30, endsAt: Date.now() + 30_000, owner: { idx: 0, i: 0 } } })
    moveEntryWithinPart(0, 1)
    expect(holdRow()).toMatchObject({ idx: 1, i: 0 })
    expect(useUI.getState().work.owner).toMatchObject({ idx: 1, i: 0 })
    setHoldRow(null)
  })
})
