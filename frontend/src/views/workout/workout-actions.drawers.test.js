// @vitest-environment happy-dom
// What the How to drawer does to the exercise (workout-actions.js, "Workout drawers-M2"): the warm-up
// row, Don't count for progression, Update routine, the exercise's rest, and Swap with its Undo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { EXIDX } from '../../lib/exercises.js'
import { isWarmupRow } from '../../lib/workout-model.js'
import { addWarmupAt, setNoProgAt, routineUpdateAt, setEntryRestAt, swapEntryWithUndo, undoSwap, UNDO_MS } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const row = (extra = {}) => ({ w: 60, r: 8, done: false, ...extra })
const BENCH = '0025'
const FLY = '0188'
const PRESS = '0426'
const ROUTINE = { id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }, { id: FLY, sets: 3, reps: 12, weight: 17.5, restSec: 90 }] }
const entry = (id, sets = [row(), row(), row()], extra = {}) => ({ id, rid: 'push', target: { sets: sets.length, reps: 8 }, sets, ...extra })

function seed(entries, cur = 0, over = {}) {
  const S = clone(DEF)
  Object.assign(S, { routines: [clone(ROUTINE)], ...over })
  S.active = { id: 'act', d: '2026-10-17', start: Date.now(), name: 'Push A', bw: null, cur, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const st = () => useStore.getState().S
const A = () => st().active
const lastToast = () => useUI.getState().toastMsg
const runUndo = () => useUI.getState().toastAction.run()

beforeEach(() => { useUI.setState({ timer: null, work: null, toastMsg: null, toastAction: null, sheet: null }) })
afterEach(() => { useStore.setState({ S: clone(DEF) }) })

describe('the How to drawer\'s rows', () => {
  it('adds a warm-up row before the work sets', () => {
    seed([entry(BENCH, [row({ w: 80 }), row({ w: 80 })])])
    addWarmupAt(0)
    expect(A().entries[0].sets).toHaveLength(3)
    expect(isWarmupRow(A().entries[0].sets[0])).toBe(true)
  })

  it('keeps one exercise out of progression, and back', () => {
    seed([entry(BENCH), entry(FLY)])
    setNoProgAt(1, true)
    expect(A().entries[1].noProg).toBe(true)
    expect(A().entries[0].noProg).toBeUndefined()
    setNoProgAt(1, false)
    expect(A().entries[1].noProg).toBeUndefined()
  })

  it('offers Update routine only when the session differs from the routine', () => {
    seed([entry(BENCH), entry(FLY, [row(), row(), row()], { target: { sets: 3, reps: 12, restSec: 90 } })])
    expect(routineUpdateAt(1)).toBeNull()
    setEntryRestAt(1, 60, { activeId: 'act', entryId: FLY })
    const found = routineUpdateAt(1)
    expect(found.routine.name).toBe('Push A')
    expect(found.sub).toContain('Rest')
  })

  it('never offers Update routine while a saved workout is edited', () => {
    seed([entry(BENCH, [row()], { target: { sets: 1, reps: 8, restSec: 45 } })], 0)
    useStore.getState().update(s => { s.active.editingWorkoutId = 'w1' })
    expect(routineUpdateAt(0)).toBeNull()
  })

  it('sets the exercise\'s rest only on the exercise it was opened for', () => {
    seed([entry(BENCH), entry(FLY)])
    setEntryRestAt(0, 150, { activeId: 'act', entryId: FLY })
    expect(A().entries[0].target.restSec).toBeUndefined()
    setEntryRestAt(1, 150, { activeId: 'act', entryId: FLY })
    expect(A().entries[1].target.restSec).toBe(150)
  })
})

describe('Swap (W1.15, W1.16)', () => {
  it('swaps for this workout only and leaves the routine as it was', () => {
    seed([entry(BENCH), entry(FLY)], 1)
    expect(swapEntryWithUndo(1, EXIDX[PRESS])).toBe(true)
    expect(A().entries[1].id).toBe(PRESS)
    expect(A().entries[1].rid).toBe('push')
    expect(st().routines[0].ex[1].id).toBe(FLY)
    expect(lastToast()).toMatch(/This workout only/)
    expect(useUI.getState().toastAction).toBeTruthy()
    expect(UNDO_MS).toBe(8000)
  })

  it('also in the routine: replaces its slot, keeping the slot\'s rest', () => {
    seed([entry(BENCH), entry(FLY)], 1)
    swapEntryWithUndo(1, EXIDX[PRESS], { alsoRoutine: true })
    expect(st().routines[0].ex[1].id).toBe(PRESS)
    expect(st().routines[0].ex[1].restSec).toBe(90)
    expect(lastToast()).toMatch(/Also in Push A/)
  })

  it('one Undo restores both the session and the routine', () => {
    seed([entry(BENCH), entry(FLY)], 1)
    const before = clone(A().entries[1])
    swapEntryWithUndo(1, EXIDX[PRESS], { alsoRoutine: true })
    runUndo()
    expect(A().entries[1]).toEqual(before)
    expect(st().routines[0].ex[1]).toEqual(ROUTINE.ex[1])
    expect(A().cur).toBe(1)
  })

  it('keeps logged sets on the original and inserts the replacement after it; Undo takes it out', () => {
    seed([entry(BENCH), entry(FLY, [row({ done: true }), row(), row()])], 1)
    swapEntryWithUndo(1, EXIDX[PRESS])
    expect(A().entries.map(e => e.id)).toEqual([BENCH, FLY, PRESS])
    runUndo()
    expect(A().entries.map(e => e.id)).toEqual([BENCH, FLY])
    expect(A().entries[1].sets[0].done).toBe(true)
  })

  it('stops a running rest before the list changes', () => {
    seed([entry(BENCH), entry(FLY)], 1)
    useUI.setState({ timer: { left: 60, total: 90, endsAt: Date.now() + 60000, forIdx: 1 } })
    swapEntryWithUndo(1, EXIDX[PRESS])
    expect(useUI.getState().timer).toBeNull()
  })

  it('an Undo after the swapped exercise is gone says so and changes nothing', () => {
    seed([entry(BENCH), entry(FLY)], 1)
    swapEntryWithUndo(1, EXIDX[PRESS])
    const token = { activeId: 'act', at: 1, inserted: false, entry: entry(FLY), cur: 1, newId: PRESS, routineId: null, slot: -1, slotWas: null }
    useStore.getState().update(s => { s.active.entries.splice(1, 1) })
    expect(undoSwap(token)).toBe(false)
    expect(A().entries.map(e => e.id)).toEqual([BENCH])
  })

  it('does nothing for the exercise that is already there', () => {
    seed([entry(BENCH)])
    expect(swapEntryWithUndo(0, EXIDX[BENCH])).toBe(false)
  })
})
