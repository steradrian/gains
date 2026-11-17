// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { deleteRoutineWithUndo } from '../../views/routines/routine-actions.js'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { mergeStates } from '../sync-merge.js'
import { restoreRoutineChange, ROUTINE_DELETE } from './routine-changes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, name, n = 1) => ({ id, name, emoji: null, ex: Array.from({ length: n }, (_, i) => ({ id: '00' + (25 + i) })) })
const S = () => useStore.getState().S
const state = (over = {}) => Object.assign(clone(DEF), {
  routines: [routine('a', 'Push A', 3), routine('b', 'Pull A'), routine('c', 'Legs')],
  week: { 0: ['a'], 1: ['a', 'b'], 4: ['a'], 5: ['c'] }, dayPlan: { '2099-01-01': 'a' }, weekStart: 0,
}, over)

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  useStore.setState({ S: state(), user: null })
  useUI.setState({ toastMsg: '', toastAction: null })
})
afterEach(() => { localStorage.clear() })

describe('routine-delete journal entries', () => {
  it('journals a delete from the routine menu or swipe, and the in-place Undo still works', () => {
    expect(deleteRoutineWithUndo('a')).toBe(true)
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({ kind: ROUTINE_DELETE, subject: 'Push A', facts: { exercises: 3 }, action: 'restore', state: 'open' })
    expect(S().routines.map(r => r.id)).toEqual(['b', 'c'])
    useUI.getState().runToastAction()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('journals nothing for a routine that is not there', () => {
    expect(deleteRoutineWithUndo('zz')).toBe(false)
    expect(listChanges()).toEqual([])
  })
})

describe('restoring a deleted routine', () => {
  it('brings it back under the same id, at its place, with its empty weekdays and reschedule', async () => {
    const before = clone(S().routines[0])
    deleteRoutineWithUndo('a')
    // Thursday was planned again with another routine; Sunday and Monday are free.
    useStore.getState().update(s => { s.week[4] = ['c'] })
    const [{ id }] = listChanges()
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { routineId: 'a' } })
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
    const back = S().routines[0]
    expect(back.name).toBe(before.name)
    expect(back.ex).toEqual(before.ex)
    expect(S().week[0]).toEqual(['a'])
    // Monday still holds Pull A (the day was not empty), so the routine does not join it.
    expect(S().week[1]).toEqual(['b'])
    expect(S().week[4]).toEqual(['c'])
    expect(S().dayPlan['2099-01-01']).toBe('a')
    expect(S().deleted.routines.a).toBeLessThan(0)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('is replaced when a routine with that id exists, and a second restore is refused', async () => {
    deleteRoutineWithUndo('a')
    const [{ id }] = listChanges()
    // the 8 s Undo got there first
    useUI.getState().runToastAction()
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'replaced' })
    expect(listChanges()[0].state).toBe('open')
    useStore.getState().update(s => { s.routines = s.routines.filter(r => r.id !== 'a') })
    expect((await restoreChange(id)).ok).toBe(true)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(S().routines.filter(r => r.id === 'a')).toHaveLength(1)
  })

  it('undoRestore takes it out again and the entry can be restored once more', async () => {
    deleteRoutineWithUndo('a')
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(S().routines.map(r => r.id)).toEqual(['b', 'c'])
    expect(S().week[0]).toBeUndefined()
    expect(listChanges()[0].state).toBe('open')
    expect((await restoreChange(id)).ok).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('a snapshot with no routine is gone', () => {
    expect(restoreRoutineChange({})).toEqual({ ok: false, reason: 'gone' })
    expect(restoreRoutineChange(null)).toEqual({ ok: false, reason: 'gone' })
  })

  it('does not journal what a restore does itself', async () => {
    deleteRoutineWithUndo('a')
    const [{ id }] = listChanges()
    await restoreChange(id)
    await undoRestore(id)
    expect(listChanges()).toHaveLength(1)
  })
})

describe('against the sync (sync-merge)', () => {
  it('a restore made after the removal wins over a device that already took the removal, either way round', async () => {
    const start = clone(S())
    deleteRoutineWithUndo('a')
    const afterDelete = clone(S())
    expect(afterDelete.deleted.routines.a).toBeGreaterThan(0)
    await restoreChange(listChanges()[0].id)
    const restored = clone(S())
    // a second device pulled the removal and changed something of its own, after everything here
    const other = clone(afterDelete)
    other.restSec = 150
    other._ts = restored._ts + 10
    for (const m of [mergeStates(restored, other), mergeStates(other, restored)]) {
      expect(m.routines.map(r => r.id).sort()).toEqual(['a', 'b', 'c'])
      expect(m.routines.find(r => r.id === 'a').ex).toEqual(start.routines[0].ex)
      expect(m.restSec).toBe(150)
    }
  })

  it('a device that never saw the delete keeps the routine, and a delete made after the restore still sticks', async () => {
    const start = clone(S())
    deleteRoutineWithUndo('a')
    await restoreChange(listChanges()[0].id)
    const restored = clone(S())
    const offline = clone(start)
    offline.restSec = 60
    offline._ts = restored._ts + 5
    expect(mergeStates(offline, restored).routines.map(r => r.id).sort()).toEqual(['a', 'b', 'c'])
    useStore.getState().update(s => { s.routines = s.routines.filter(r => r.id !== 'a') })
    const deletedAgain = clone(S())
    for (const m of [mergeStates(deletedAgain, offline), mergeStates(offline, deletedAgain)]) {
      expect(m.routines.map(r => r.id).sort()).toEqual(['b', 'c'])
    }
  })
})
