// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { deleteRoutine } from '../../lib/routines.js'
import {
  addRoutine, copyNameOf, deletedText, deleteRoutineWithUndo, duplicateRoutine, routineDaysOf, saveRoutineDays, setRoutineDays,
} from './routine-actions.js'

vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025' }] })
const S = () => useStore.getState().S
const undo = () => useUI.getState().runToastAction()
const state = (over = {}) => Object.assign(clone(DEF), {
  routines: [routine('a', 'Push A'), routine('b', 'Pull A'), routine('c', 'Legs')],
  week: { 0: ['a'], 1: ['a', 'b'], 4: ['a'], 5: ['c'] }, dayPlan: {}, weekStart: 0,
}, over)

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: state(), user: null })
  useUI.setState({ toastMsg: '', toastAction: null })
})
afterEach(() => { localStorage.clear() })

describe('deletedText (T4.3)', () => {
  it('names only the weekdays the routine was alone on, in the order the week runs', () => {
    // Monday keeps Pull A, so it is not a rest day.
    expect(deletedText(state(), 'a')).toBe('Deleted Push A. Sun and Thu are now rest days')
  })

  it('one day is a rest day; none says just what went', () => {
    expect(deletedText(state(), 'c')).toBe('Deleted Legs. Fri is now a rest day')
    expect(deletedText(state(), 'b')).toBe('Deleted Pull A.')
  })

  it('counts the dated reschedules that go with it', () => {
    const s = state({ dayPlan: { '2099-01-01': 'a', '2099-01-02': 'a', '2099-01-03': 'c' } })
    expect(deletedText(s, 'a')).toBe('Deleted Push A. Sun and Thu are now rest days and 2 planned dates are cleared')
    expect(deletedText(state({ dayPlan: { '2099-01-01': 'b' } }), 'b')).toBe('Deleted Pull A. 1 planned date is cleared')
  })

  it('a legacy single id on a weekday counts as that routine alone', () => {
    expect(deletedText(state({ week: { 2: 'b' } }), 'b')).toBe('Deleted Pull A. Tue is now a rest day')
  })

  it('matches what deleteRoutine does to the week', () => {
    const s = state()
    const before = clone(s)
    deleteRoutine(s, 'a')
    const rest = [0, 1, 2, 3, 4, 5, 6].filter(d => before.week[d] && !s.week[d])
    expect(rest).toEqual([0, 4])
  })
})

describe('deleteRoutineWithUndo', () => {
  it('deletes at once with T4.3’s toast, and Undo puts it back where it was', () => {
    expect(deleteRoutineWithUndo('a')).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(['b', 'c'])
    expect(useUI.getState().toastMsg).toBe('Deleted Push A. Sun and Thu are now rest days')
    undo()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(S().week).toEqual(state().week)
  })

  it('is false for a routine that is not there', () => {
    expect(deleteRoutineWithUndo('nope')).toBe(false)
  })
})

describe('setRoutineDays', () => {
  it('puts the routine on exactly those days, appending to combined days and never leaving []', () => {
    const s = state()
    const done = setRoutineDays(s, 'a', [1, 5])
    expect(s.week).toEqual({ 1: ['a', 'b'], 5: ['c', 'a'] })
    expect(done.added).toEqual([5])
    expect(done.removed).toEqual({ 0: 0, 4: 0 })
  })

  it('takes it off a combined day and keeps the other routine', () => {
    const s = state()
    setRoutineDays(s, 'a', [])
    expect(s.week).toEqual({ 1: ['b'], 5: ['c'] })
  })

  it('is null when nothing changes', () => {
    const s = state()
    expect(setRoutineDays(s, 'a', [0, 1, 4])).toBe(null)
    expect(s.week).toEqual(state().week)
  })

  it('its undo puts the days back, at the old place on a combined day', () => {
    const s = state({ week: { 1: ['b', 'a', 'c'] } })
    const done = setRoutineDays(s, 'a', [3])
    expect(s.week).toEqual({ 1: ['b', 'c'], 3: ['a'] })
    done.undo(s)
    expect(s.week).toEqual({ 1: ['b', 'a', 'c'] })
  })

  it('its undo puts nothing back for a routine deleted since', () => {
    const s = state()
    const done = setRoutineDays(s, 'a', [2])
    deleteRoutine(s, 'a')
    done.undo(s)
    expect(s.week).toEqual({ 1: ['b'], 5: ['c'] })
  })

  it('saveRoutineDays says where it is now, with Undo; routineDaysOf reads the week in its order', () => {
    expect(saveRoutineDays('b', [3, 1])).toBe(true)
    expect(routineDaysOf(S(), 'b')).toEqual([1, 3])
    expect(useUI.getState().toastMsg).toBe('Pull A is on Mon and Wed')
    undo()
    expect(S().week).toEqual(state().week)
    expect(saveRoutineDays('b', [1])).toBe(false)
    expect(saveRoutineDays('c', [])).toBe(true)
    expect(useUI.getState().toastMsg).toBe('Legs is on no weekday')
  })
})

describe('duplicateRoutine', () => {
  it('inserts the copy right after the original, planned nowhere, named as the menu says', () => {
    const name = copyNameOf(S().routines[0])
    const copy = duplicateRoutine('a')
    expect(copy.name).toBe(name)
    expect(name).toBe('Push A (Copy)')
    expect(S().routines.map(r => r.name)).toEqual(['Push A', 'Push A (Copy)', 'Pull A', 'Legs'])
    expect(S().week).toEqual(state().week)
    expect(useUI.getState().toastMsg).toBe('Copied as “Push A (Copy)”.')
    undo()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('the menu’s opens the copy', () => {
    const go = vi.fn()
    const copy = duplicateRoutine('b', { open: true, go })
    expect(go).toHaveBeenCalledWith('/train/routines/' + copy.id)
    expect(duplicateRoutine('nope', { open: true, go })).toBe(null)
  })
})

describe('addRoutine', () => {
  it('makes an empty routine and opens it in its new state', () => {
    const go = vi.fn()
    addRoutine(go)
    const r = S().routines.at(-1)
    expect(r).toMatchObject({ name: 'New routine', ex: [] })
    expect(go).toHaveBeenCalledWith('/train/routines/' + r.id + '?new=1')
  })
})
