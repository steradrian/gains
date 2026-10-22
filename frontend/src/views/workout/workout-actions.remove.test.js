// @vitest-environment happy-dom
// Removing an exercise from the running workout, ported from views/Workout.remove.test.jsx
// (guard-M2a). Dropped by design: the confirmation dialog and the superset member chooser (:152,
// :170) are replaced by remove with an 8 s Undo (W1.17, workout-actions.test.js 'remove an exercise
// with Undo' and exercise-drawers.test.jsx 'removes the exercise with Undo'), and the dialog's
// locale keys (:199) go with the old screen's keys in guard-M2b. The empty-session case (:193) has
// no How to to open.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { removeActiveExercise } from './workout-actions.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const entry = (id, sg) => ({ id, ...(sg ? { sg } : {}), target: { mode: 'reps', sets: 1, reps: 1 }, sets: [{ w: 0, r: 1, done: false }] })

function seed(entries, cur = 0) {
  const S = clone(DEF)
  S.active = { id: 'remove-test', d: '2026-08-11', start: Date.now(), name: 'Remove test', bw: null, cur, entries }
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
})
afterEach(() => {
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useStore.setState({ S: clone(DEF) })
  vi.useRealTimers()
})

describe('removing an exercise under a running timer', () => {
  // old :97
  it('cancels a pending timed callback before indexes shift and cleans a one-member group', () => {
    seed([entry('1001', 'sg-1'), entry('1002', 'sg-1'), entry('1003')], 1)
    const wrongWrite = vi.fn(elapsed => {
      useStore.getState().update(s => { s.active.entries[0].sets[0].sec = elapsed })
    })
    useUI.getState().startWork(5, 'Hold', wrongWrite)

    removeActiveExercise(0)
    vi.advanceTimersByTime(10_000)

    expect(useUI.getState().work).toBeNull()
    expect(wrongWrite).not.toHaveBeenCalled()
    expect(A().entries.map(e => e.id)).toEqual(['1002', '1003'])
    expect(A().cur).toBe(0)
    expect(A().entries[0].sg).toBeUndefined()
    expect(A().entries[0].sets[0].sec).toBeUndefined()
  })

  // old :117
  it('cancels a running rest countdown when the exercise it belongs to is removed', () => {
    seed([entry('1001'), entry('1002')])
    useUI.getState().startRest(90, 0)
    removeActiveExercise(0)
    expect(useUI.getState().timer).toBeNull()
    expect(A().entries.map(e => e.id)).toEqual(['1002'])
  })

  // old :128
  it('keeps a rest countdown that belongs to another exercise, re-pointed at it', () => {
    seed([entry('1001'), entry('1002'), entry('1003')], 1)
    useUI.getState().startRest(90, 1)

    removeActiveExercise(0)
    expect(useUI.getState().timer?.forIdx).toBe(0)
    expect(A().entries.map(e => e.id)).toEqual(['1002', '1003'])

    removeActiveExercise(1)
    expect(useUI.getState().timer?.forIdx).toBe(0)
    expect(A().entries.map(e => e.id)).toEqual(['1002'])

    removeActiveExercise(0)
    expect(useUI.getState().timer).toBeNull()
  })

  // old :144
  it('leaves a rest countdown without a known owner running', () => {
    seed([entry('1001'), entry('1002')])
    useUI.getState().startRest(90)
    removeActiveExercise(0)
    expect(useUI.getState().timer).not.toBeNull()
  })

  // old :87: while a hold runs How to offers no Remove row (exercise-drawers.test.jsx 'offers no
  // Remove row while a hold runs'); removeActiveExercise itself stops the hold, for the other callers.
})

describe('removing an exercise: edge cases', () => {
  // old :225
  it('removing the last remaining exercise leaves an empty, coherent session', () => {
    seed([entry('a')])
    removeActiveExercise(0)
    expect(A().entries).toHaveLength(0)
    expect(A().cur).toBe(0)
  })

  // old :233
  it('removing one half of a two-member superset dissolves the group', () => {
    seed([entry('a', 'g1'), entry('b', 'g1'), entry('c')])
    removeActiveExercise(1)
    expect(A().entries.map(e => e.id)).toEqual(['a', 'c'])
    expect(A().entries[0].sg).toBeUndefined()
  })

  // old :242
  it('removing an entry below the active one keeps cur on the same exercise', () => {
    seed([entry('a'), entry('b'), entry('c')], 2)
    removeActiveExercise(0)
    expect(A().entries.map(e => e.id)).toEqual(['b', 'c'])
    expect(A().entries[A().cur].id).toBe('c')
  })

  // old :170: the second of two equal ids goes, not the first
  it('removes the occurrence at the index, not the first with the same exercise id', () => {
    const first = entry('1001', 'pair')
    first.target.marker = 'keep-first'
    const second = entry('1001', 'pair')
    second.target.marker = 'remove-second'
    seed([first, second, entry('1002')])
    removeActiveExercise(1)
    expect(A().entries.map(e => e.id)).toEqual(['1001', '1002'])
    expect(A().entries[0].target.marker).toBe('keep-first')
    expect(A().entries[0].sg).toBeUndefined()
  })

  // old :250
  it('persists the shortened active session for reload without changing completed history', () => {
    const first = entry('same')
    first.target.marker = 'keep-first'
    const second = entry('same')
    second.target.marker = 'remove-second'
    seed([first, second, entry('other')], 1)
    const workouts = [{ id: 'completed', d: '2026-08-10', entries: [{ id: 'same', sets: [{ w: 42, r: 5, done: true }] }] }]
    useStore.setState(state => ({ S: { ...state.S, workouts: clone(workouts) } }))

    removeActiveExercise(1)

    const persisted = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(persisted.workouts).toEqual(workouts)
    expect(persisted.active.entries.map(e => e.id)).toEqual(['same', 'other'])
    expect(persisted.active.entries[0].target.marker).toBe('keep-first')
    expect(persisted.active.cur).toBe(1)
  })
})
