// The running workout's store actions (views/workout/workout-actions.js), against a seeded store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import {
  setNumberAt, deleteActiveSet, undoDeleteSet, copyActiveSet, removeActiveExercise, setFieldAt, stepFieldAt, stepLoad,
  setEffortAt, stepEffortAt, toggleWarmupRowAt, toggleFailureAt, addDropAt, addBurstAt, removeDropOf, removeBurstOf,
  setDropFieldAt, setBurstAt, setSideFieldAt, stepSideFieldAt, removeExerciseWithUndo, undoRemoveExercise,
  moveEntryWithinPart, pairWithNext, unpairAt, setPartSkipped, markOffered, setEntryPart, UNDO_MS,
} from './workout-actions.js'
import { makeSideSet } from '../../lib/workout-model.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const row = (extra = {}) => ({ w: 60, r: 8, done: false, ...extra })
const entry = (id, sets = [row(), row(), row()], extra = {}) => ({ id, target: { sets: sets.length, reps: 8 }, sets, ...extra })

function seed(entries, cur = 0, over = {}) {
  const S = clone(DEF)
  Object.assign(S, over)
  S.active = { id: 'act', d: '2026-10-17', start: Date.now(), name: 'Push A', bw: null, cur, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active
const sets = (idx = 0) => A().entries[idx].sets
const lastToast = () => useUI.getState().toastMsg
const runUndo = () => useUI.getState().toastAction.run()

beforeEach(() => { useUI.setState({ timer: null, work: null, toastMsg: null, toastAction: null, setFlash: null }) })
afterEach(() => { useStore.setState({ S: clone(DEF) }) })

describe('set numbers', () => {
  it('counts warm-ups and work sets each from 1, a per-side pair as one set', () => {
    const list = [row({ phase: 'warmup' }), row({ phase: 'warmup' }), row(), row()]
    expect([0, 1, 2, 3].map(i => setNumberAt(list, i))).toEqual([1, 2, 1, 2])
    const pairs = [row({ side: 'L' }), row({ side: 'R' }), row({ side: 'L' }), row({ side: 'R' })]
    expect([0, 1, 2, 3].map(i => setNumberAt(pairs, i))).toEqual([1, 1, 2, 2])
  })
})

describe('remove, undo and copy a set (moved from Workout.jsx)', () => {
  it('removes a set with Undo, and Undo puts it back where it was', () => {
    seed([entry('bench', [row({ w: 60 }), row({ w: 70 }), row({ w: 80 })])])
    expect(deleteActiveSet(0, 1)).toBe(true)
    expect(sets().map(s => s.w)).toEqual([60, 80])
    expect(lastToast()).toBe('Set 2 gone.')
    runUndo()
    expect(sets().map(s => s.w)).toEqual([60, 70, 80])
    expect(useUI.getState().setFlash).toMatchObject({ idx: 0, i: 1 })
  })

  it('keeps one set in a live session, and the editor may take them all', () => {
    seed([entry('bench', [row()])])
    expect(deleteActiveSet(0, 0)).toBe(false)
    expect(lastToast()).toBe('Keep at least one set, champ')
    expect(deleteActiveSet(0, 0, { editing: true })).toBe(true)
    expect(sets()).toHaveLength(0)
  })

  it('stops the rest the removed set started and says so', () => {
    seed([entry('bench')])
    useUI.setState({ timer: { left: 60, total: 90, endsAt: Date.now() + 60000, forIdx: 0, forSet: 1 } })
    deleteActiveSet(0, 1)
    expect(useUI.getState().timer).toBeNull()
    expect(lastToast()).toBe('Set 2 gone. Its timer stopped too.')
  })

  it('Undo finds the exercise by id after it moved, and says too late once the workout is gone', () => {
    seed([entry('bench'), entry('row')])
    deleteActiveSet(1, 0)
    const token = { activeId: 'act', idx: 1, entryId: 'row', i: 0, rows: [row({ w: 99 })] }
    useStore.getState().update(s => { s.active.entries.reverse() })
    expect(undoDeleteSet(token)).toBe(true)
    expect(sets(0)[0].w).toBe(99)
    useStore.getState().update(s => { s.active = null })
    expect(undoDeleteSet(token)).toBe(false)
    expect(lastToast()).toBe('Too late, that one’s gone')
  })

  it('copies a set right below it', () => {
    seed([entry('bench', [row({ w: 60 }), row({ w: 80, r: 5 })])])
    copyActiveSet(0, 1)
    expect(sets().map(s => [s.w, s.r])).toEqual([[60, 8], [80, 5], [80, 5]])
    expect(lastToast()).toBe('Copied. One more like that one.')
  })

  it('removing an exercise keeps cur on the same exercise and ends only its own rest', () => {
    seed([entry('a'), entry('b'), entry('c')], 2)
    useUI.setState({ timer: { left: 60, total: 90, endsAt: Date.now() + 60000, forIdx: 2, forSet: 0 } })
    removeActiveExercise(0)
    expect(A().entries.map(e => e.id)).toEqual(['b', 'c'])
    expect(A().cur).toBe(1)
    expect(useUI.getState().timer.forIdx).toBe(1)
  })
})

describe('one set\'s fields', () => {
  it('setFieldAt cascades a weight to the inherited sets after it and marks it manual', () => {
    seed([entry('bench', [row({ w: 60 }), row({ w: 60 }), row({ w: 60 })])])
    setFieldAt(0, 0, 'w', 70)
    expect(sets().map(s => s.w)).toEqual([70, 70, 70])
    expect(sets()[0].weightOrigin).toBe('manual')
  })

  it('a cleared optional field drops its key, and a typed duration drops the set-aside plan', () => {
    seed([entry('plank', [row({ sec: 30, planSec: 45, incline: 2 })])])
    setFieldAt(0, 0, 'incline', null)
    expect('incline' in sets()[0]).toBe(false)
    setFieldAt(0, 0, 'sec', 40)
    expect(sets()[0]).toMatchObject({ sec: 40 })
    expect('planSec' in sets()[0]).toBe(false)
  })

  it('steps a field by its step, never below 0, and a load along the owned bells', () => {
    seed([entry('curl', [row({ r: 1, w: 9 })])])
    stepFieldAt(0, 0, { f: 'r', step: 1 }, -1)
    stepFieldAt(0, 0, { f: 'r', step: 1 }, -1)
    expect(sets()[0].r).toBe(0)
    stepFieldAt(0, 0, { f: 'w', step: 2.5 }, 1, { weight: true, owned: [9, 11, 13] })
    expect(sets()[0].w).toBe(11)
    expect(stepLoad(60, 2.5, 1)).toBe(62.5)
  })

  it('steps a converted column in the unit on screen', () => {
    seed([entry('tread', [row({ speed: 8 })])])
    const col = { f: 'speed', step: 0.5, view: v => v / 2, store: v => v * 2 }
    stepFieldAt(0, 0, col, 1)
    expect(sets()[0].speed).toBe(9)
  })

  it('sets and steps the effort', () => {
    seed([entry('bench', [row()])])
    setEffortAt(0, 0, 'rir', 2)
    expect(sets()[0].rir).toBe(2)
    stepEffortAt(0, 0, 'rir', 'rir', -1)
    expect(sets()[0].rir).toBe(1)
    setEffortAt(0, 0, 'rir', null)
    expect('rir' in sets()[0]).toBe(false)
  })

  it('makes a row a warm-up and back', () => {
    seed([entry('bench', [row({ w: 60 }), row({ w: 80 })])])
    toggleWarmupRowAt(0, 0, true)
    expect(sets()[0].phase).toBe('warmup')
    toggleWarmupRowAt(0, 0, false)
    expect(sets().some(s => s.phase === 'warmup')).toBe(false)
  })

  it('toggles taken to failure', () => {
    seed([entry('bench', [row()])])
    toggleFailureAt(0, 0)
    expect(sets()[0].failure).toBe(true)
    toggleFailureAt(0, 0)
    expect(sets()[0].failure).toBeUndefined()
  })
})

describe('drops, bursts and sides', () => {
  it('adds, edits and removes a drop', () => {
    seed([entry('bench', [row({ w: 80, r: 8 })])])
    addDropAt(0, 0)
    expect(sets()[0].drops).toHaveLength(1)
    expect(sets()[0].drops[0].w).toBeLessThan(80)
    setDropFieldAt(0, 0, 0, 'r', 6)
    expect(sets()[0].drops[0].r).toBe(6)
    removeDropOf(0, 0, 0)
    expect(sets()[0].drops || []).toHaveLength(0)
  })

  it('keeps a rest-pause row\'s reps the total across its bursts', () => {
    seed([entry('bench', [row({ r: 8 })])])
    addBurstAt(0, 0)
    const added = sets()[0].clusters[0].r
    expect(sets()[0].r).toBe(8 + added)
    setBurstAt(0, 0, 0, added + 1)
    expect(sets()[0].r).toBe(9 + added)
    removeBurstOf(0, 0, 0)
    expect(sets()[0].r).toBe(8)
  })

  it('edits one side of a per-side row and steps reps by one per side', () => {
    seed([entry('lunge', [makeSideSet({ w: 10, r: 16, done: false })])])
    setSideFieldAt(0, 0, 'L', 'w', 12)
    expect(sets()[0].sides.L.w).toBe(12)
    expect(sets()[0].sides.L.weightOrigin).toBe('manual')
    stepSideFieldAt(0, 0, 'R', { f: 'r', step: 2 }, 1)
    expect(sets()[0].sides.R.r).toBe(9)
  })
})

describe('remove an exercise with Undo (W1.17)', () => {
  it('removes at once and Undo puts it back, cur and superset included', () => {
    seed([entry('a', undefined, { sg: 'g' }), entry('b', undefined, { sg: 'g' }), entry('c')], 2)
    expect(removeExerciseWithUndo(1)).toBe(true)
    expect(A().entries.map(e => e.id)).toEqual(['a', 'c'])
    expect(A().entries[0].sg).toBeUndefined()
    expect(useUI.getState().toastAction.ms).toBe(UNDO_MS)
    runUndo()
    expect(A().entries.map(e => [e.id, e.sg])).toEqual([['a', 'g'], ['b', 'g'], ['c', undefined]])
    expect(A().cur).toBe(2)
  })

  it('Undo after the workout ended is too late', () => {
    seed([entry('a'), entry('b')])
    removeExerciseWithUndo(0)
    const token = { activeId: 'act', idx: 0, entry: entry('a') }
    useStore.getState().update(s => { s.active = null })
    expect(undoRemoveExercise(token)).toBe(false)
  })
})

describe('order and parts', () => {
  const pushA = () => [
    entry('w1', undefined, { part: 'warmup' }), entry('w2', undefined, { part: 'warmup' }),
    entry('bench'), entry('a1', undefined, { sg: 's' }), entry('a2', undefined, { sg: 's' }), entry('fly'),
    entry('c1', undefined, { part: 'cooldown' }),
  ]

  it('moves within a part, a superset as one unit, and keeps cur on its exercise', () => {
    seed(pushA(), 5)
    expect(moveEntryWithinPart(2, 5)).toBe(5)
    expect(A().entries.map(e => e.id)).toEqual(['w1', 'w2', 'a1', 'a2', 'fly', 'bench', 'c1'])
    expect(A().entries[A().cur].id).toBe('fly')
  })

  it('never moves across a part', () => {
    seed(pushA())
    expect(moveEntryWithinPart(2, 0)).toBeNull()
    expect(A().entries.map(e => e.id)).toEqual(pushA().map(e => e.id))
    moveEntryWithinPart(1, 4)
    expect(A().entries[1].id).toBe('w2')
    moveEntryWithinPart(0, 1)
    expect(A().entries.slice(0, 3).map(e => e.id)).toEqual(['w2', 'w1', 'bench'])
  })

  it('pairs with the next exercise inside a part and unpairs', () => {
    seed(pushA())
    expect(pairWithNext(1)).toBe(false)
    expect(pairWithNext(0)).toBe(true)
    expect(A().entries[0].sg).toBeTruthy()
    expect(A().entries[0].sg).toBe(A().entries[1].sg)
    unpairAt(0)
    expect(A().entries[0].sg).toBeUndefined()
    expect(A().entries[1].sg).toBeUndefined()
  })

  it('skips a part and puts it back, and marks an offer as shown', () => {
    seed(pushA())
    setPartSkipped('cooldown', true)
    expect(A().skipped).toEqual({ cooldown: true })
    setPartSkipped('cooldown', false)
    expect(A().skipped).toBeUndefined()
    markOffered('cooldown')
    markOffered('warmup')
    expect(A().offered).toEqual({ cooldown: true, warmup: true })
  })

  it('moves an exercise into another part, re-sorted, out of its superset, cur on the same entry', () => {
    seed(pushA(), 5)
    expect(setEntryPart(4, 'cooldown')).toBe(true)
    expect(A().entries.map(e => e.id)).toEqual(['w1', 'w2', 'bench', 'a1', 'fly', 'a2', 'c1'])
    expect(A().entries[5].part).toBe('cooldown')
    expect(A().entries[3].sg).toBeUndefined()
    expect(A().entries[A().cur].id).toBe('fly')
    setEntryPart(0, 'main')
    expect(A().entries.map(e => e.id)).toEqual(['w2', 'w1', 'bench', 'a1', 'fly', 'a2', 'c1'])
    expect('part' in A().entries[1]).toBe(false)
    expect(setEntryPart(1, 'main')).toBe(false)
  })

  it('a rest follows the exercise that started it when parts re-sort', () => {
    seed(pushA(), 5)
    useUI.setState({ timer: { left: 60, total: 90, endsAt: Date.now() + 60000, forIdx: 5, forSet: 0 } })
    setEntryPart(5, 'warmup')
    expect(A().entries.map(e => e.id)).toEqual(['w1', 'w2', 'fly', 'bench', 'a1', 'a2', 'c1'])
    expect(useUI.getState().timer.forIdx).toBe(2)
    expect(A().entries[A().cur].id).toBe('fly')
  })
})
