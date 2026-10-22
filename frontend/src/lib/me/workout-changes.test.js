// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { deleteWorkoutWithUndo } from '../../sheets.jsx'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { createMediaStore, memoryBackend, _setMediaStore } from '../media-store.js'
import { mergeStates } from '../sync-merge.js'
import { recordEditedWorkoutDelete, restoreWorkoutChange, WORKOUT_DELETE } from './workout-changes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const done = (w, r) => ({ w, r, done: true })
const workout = (id, d, start, over = {}) => ({
  id, d, start, end: start + 3600e3, name: 'Push', vol: 0, prs: [], routineIds: [],
  entries: [{ id: '0025', sets: [done(60, 5), done(60, 5), done(62.5, 4)] }], ...over,
})
const W = [workout('w0', '2026-09-01', 1000), workout('w1', '2026-09-15', 2000, { note: 'felt strong' }), workout('w2', '2026-09-20', 3000)]

let toast
beforeEach(() => {
  localStorage.clear()
  removeEntries()
  toast = vi.fn()
  useUI.setState({ sheets: [], toast })
  _setMediaStore(createMediaStore({ ...memoryBackend(), persistent: true, name: 'test' }, { objectURL: { createObjectURL: () => 'blob:t/1', revokeObjectURL() {} } }))
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', routines: [], workouts: clone(W), active: null, exWeights: { '0025': { w: 62.5, d: '2026-09-15' } } }), user: null })
})
afterEach(() => { localStorage.clear(); _setMediaStore(null) })

const del = () => deleteWorkoutWithUndo(W[1])
// The 8 s Undo of the last delete's toast.
const undoInPlace = () => toast.mock.calls.at(-1)[1].onAction()

describe('workout-delete journal entries', () => {
  it('journals a delete from the detail sheet; the in-place Undo is untouched', () => {
    expect(del()).toBe(true)
    const [row, ...rest] = listChanges()
    expect(rest).toEqual([])
    expect(row).toMatchObject({ kind: WORKOUT_DELETE, subject: 'Push', day: '2026-09-15', facts: { day: '2026-09-15', sets: 3 }, action: 'restore', state: 'open' })
    expect('snapshot' in row).toBe(false)
    expect(S().workouts.map(w => w.id)).toEqual(['w0', 'w2'])
    undoInPlace()
    expect(S().workouts.map(w => w.id)).toEqual(['w0', 'w1', 'w2'])
  })

  it('journals nothing when there was nothing to delete', () => {
    del()
    expect(del()).toBe(false)
    expect(listChanges()).toHaveLength(1)
  })

  it('journals the editor\'s delete of a workout with every set taken out', () => {
    const rec = S().workouts[1]
    expect(recordEditedWorkoutDelete(S(), rec)).toEqual(expect.any(String))
    expect(listChanges()[0]).toMatchObject({ kind: WORKOUT_DELETE, subject: 'Push', facts: { day: '2026-09-15', sets: 3 } })
    expect(recordEditedWorkoutDelete(S(), { id: 'zz' })).toBeNull()
  })
})

describe('restoring a deleted workout', () => {
  it('puts the exact record back at its place and marks it added back', async () => {
    del()
    const [{ id }] = listChanges()
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: '2026-09-15' } })
    expect(S().workouts.map(w => w.id)).toEqual(['w0', 'w1', 'w2'])
    expect(S().workouts[1]).toMatchObject({ note: 'felt strong', entries: W[1].entries })
    expect(S().deleted.workouts.w1).toBeLessThan(0)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('brings the kept working weight back only where nothing has been confirmed since', async () => {
    del()
    const [{ id }] = listChanges()
    useStore.getState().update(s => { delete s.exWeights['0025'] })
    await restoreChange(id)
    expect(S().exWeights['0025']).toEqual({ w: 62.5, d: '2026-09-15' })

    del()
    useStore.getState().update(s => { s.exWeights['0025'] = { w: 70, d: '2026-09-18' } })
    await restoreChange(listChanges()[0].id)
    expect(S().exWeights['0025']).toEqual({ w: 70, d: '2026-09-18' })
  })

  it('is replaced when the workout is already there, refuses a second restore, and undoes', async () => {
    del()
    const [{ id }] = listChanges()
    undoInPlace()
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'replaced' })
    useStore.getState().update(s => { s.workouts = s.workouts.filter(w => w.id !== 'w1') })
    expect((await restoreChange(id)).ok).toBe(true)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(S().workouts.filter(w => w.id === 'w1')).toHaveLength(1)
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(S().workouts.map(w => w.id)).toEqual(['w0', 'w2'])
    expect(listChanges()[0].state).toBe('open')
  })

  it('a snapshot with nothing in it is gone; a restore is not journalled', async () => {
    expect(restoreWorkoutChange({})).toEqual({ ok: false, reason: 'gone' })
    del()
    await restoreChange(listChanges()[0].id)
    expect(listChanges()).toHaveLength(1)
  })
})

describe('against the sync (sync-merge)', () => {
  it('a restore wins over a device that already took the removal, either way round', async () => {
    del()
    const afterDelete = clone(S())
    expect(afterDelete.deleted.workouts.w1).toBeGreaterThan(0)
    await restoreChange(listChanges()[0].id)
    const restored = clone(S())
    const other = clone(afterDelete)
    other.restSec = 150
    other._ts = restored._ts + 10
    for (const m of [mergeStates(restored, other), mergeStates(other, restored)]) {
      expect(m.workouts.map(w => w.id).sort()).toEqual(['w0', 'w1', 'w2'])
      expect(m.workouts.find(w => w.id === 'w1').entries).toEqual(W[1].entries)
      expect(m.restSec).toBe(150)
    }
  })

  it('a delete made after the restore still sticks on the other device', async () => {
    del()
    await restoreChange(listChanges()[0].id)
    const offline = clone(S())
    offline._ts += 5
    useStore.getState().update(s => { s.workouts = s.workouts.filter(w => w.id !== 'w1') })
    const deletedAgain = clone(S())
    for (const m of [mergeStates(deletedAgain, offline), mergeStates(offline, deletedAgain)]) {
      expect(m.workouts.map(w => w.id)).toEqual(['w0', 'w2'])
    }
  })
})
