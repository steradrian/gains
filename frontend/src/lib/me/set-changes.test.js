// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { saveWorkoutEdits } from '../../sheets.jsx'
import { setNav } from '../nav.js'
import { EXDB, exOr } from '../exercises.js'
import { editCompletedSession } from '../session-edit.js'
import { listChanges, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { mergeStates } from '../sync-merge.js'
import { recordSetDeletes, removedIndexes, removedSets, restoreSetChange, SET_DELETE } from './set-changes.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const [A, B] = EXDB.filter(e => e.bp !== 'cardio').slice(0, 2).map(e => e.id)
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const set = (w, r) => ({ w, r, done: true })
const saved = () => ({
  id: 'w-old', d: '2026-09-10', start: 1, end: 2, name: 'Push', prs: [],
  entries: [
    { id: A, target: { mode: 'reps', reps: 8 }, sets: [set(50, 8), set(60, 8), set(65, 5)] },
    { id: B, target: { mode: 'reps', reps: 10 }, sets: [set(20, 10), set(20, 10)] },
  ],
})
const recordOf = (entries, id = 'w-old') => ({ ...saved(), id, entries })

beforeEach(() => {
  localStorage.clear()
  removeEntries()
  setNav(() => {})
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: Object.assign(clone(DEF), { unit: 'kg', routines: [], workouts: [saved()], active: null, exWeights: {} }), user: null })
})
afterEach(() => { localStorage.clear() })

// Opens the editor on the saved workout, runs `edit` on the draft, and saves.
function editAndSave(edit) {
  useStore.getState().update(s => { editCompletedSession(s, 'w-old'); edit(s.active) })
  saveWorkoutEdits(() => {})
}

describe('which sets an edit removed', () => {
  const [a, b, c, d] = [set(1, 1), set(2, 2), set(3, 3), set(4, 4)]

  it('reads a set taken out of the middle, the end or the start by what is left', () => {
    expect(removedIndexes([a, b, c], [a, c])).toEqual([1])
    expect(removedIndexes([a, b, c], [a, b])).toEqual([2])
    expect(removedIndexes([a, b, c], [b, c])).toEqual([0])
    expect(removedIndexes([a, b], [])).toEqual([0, 1])
  })

  it('does not take an edited set, or an added one, for a removal', () => {
    expect(removedIndexes([a, b], [a, set(2, 3)])).toEqual([])
    expect(removedIndexes([a, b], [a, b, c])).toEqual([])
    expect(removedIndexes(undefined, undefined)).toEqual([])
  })

  it('counts one removal when one set went and another was edited', () => {
    expect(removedIndexes([a, b, c, d], [a, c, set(4, 9)])).toHaveLength(1)
  })

  it('names the entry by exercise and occurrence, skips an exercise taken out whole', () => {
    const before = recordOf([{ id: A, sets: [a, b] }, { id: B, sets: [c] }, { id: A, sets: [c, d] }])
    const after = recordOf([{ id: A, sets: [a, b] }, { id: A, sets: [d] }])
    expect(removedSets(before, after)).toEqual([{ workoutKey: 'w-old', entryId: A, occ: 1, index: 0, set: c }])
  })
})

describe('journalling the sets a saved edit removed', () => {
  it('saveWorkoutEdits journals one entry per removed set', () => {
    editAndSave(active => { active.entries[0].sets.splice(1, 1); active.entries[1].sets.pop() })
    const rows = listChanges()
    expect(rows).toHaveLength(2)
    const byName = Object.fromEntries(rows.map(r => [r.subject, r]))
    expect(byName[exOr(A).n]).toMatchObject({ kind: SET_DELETE, day: '2026-09-10', facts: { day: '2026-09-10', weight: 60, reps: 8 }, action: 'restore', state: 'open' })
    expect(byName[exOr(B).n].facts).toEqual({ day: '2026-09-10', weight: 20, reps: 10 })
    expect(S().workouts[0].entries[0].sets.map(s => s.w)).toEqual([50, 65])
  })

  it('journals nothing for a save that changed nothing, or only edited a set', () => {
    editAndSave(() => {})
    editAndSave(active => { active.entries[0].sets[0].w = 55 })
    expect(listChanges()).toEqual([])
  })

  it('never throws on a record it cannot read', () => {
    expect(recordSetDeletes(null, null)).toEqual([])
    expect(recordSetDeletes({ entries: 5 }, { entries: [{}] })).toEqual([])
  })
})

describe('restoring a removed set', () => {
  const removeMiddle = () => editAndSave(active => { active.entries[0].sets.splice(1, 1) })

  it('puts it back at its index and stamps the workout', async () => {
    removeMiddle()
    const stampAfterEdit = S().workouts[0]._ts
    const [{ id }] = listChanges()
    const res = await restoreChange(id)
    expect(res).toEqual({ ok: true, where: { day: '2026-09-10', index: 1 } })
    const w = S().workouts[0]
    expect(w.entries[0].sets.map(s => s.w)).toEqual([50, 60, 65])
    expect(w.entries[0].topW).toBe(65)
    expect(w._ts).toBeGreaterThan(stampAfterEdit)
    expect(w.vol).toBeGreaterThan(0)
    expect(listChanges()[0].state).toBe('restored')
  })

  it('lands at the end when the entry has fewer sets by now', async () => {
    removeMiddle()
    editAndSave(active => { active.entries[0].sets.pop() })
    await restoreChange(listChanges().find(r => r.facts.weight === 60).id)
    expect(S().workouts[0].entries[0].sets.map(s => s.w)).toEqual([50, 60])
  })

  it('is gone when the workout or the entry is', async () => {
    removeMiddle()
    const [{ id }] = listChanges()
    useStore.getState().update(s => { s.workouts[0].entries = s.workouts[0].entries.filter(e => e.id !== A) })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'gone' })
    useStore.getState().update(s => { s.workouts = [] })
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'gone' })
    expect(restoreSetChange(null)).toEqual({ ok: false, reason: 'gone' })
    expect(listChanges()[0].state).toBe('open')
  })

  it('a second restore is refused, and undoRestore takes the set out again', async () => {
    removeMiddle()
    const [{ id }] = listChanges()
    await restoreChange(id)
    expect(await restoreChange(id)).toEqual({ ok: false, reason: 'restored' })
    expect(S().workouts[0].entries[0].sets).toHaveLength(3)
    expect(await undoRestore(id)).toEqual({ ok: true })
    expect(S().workouts[0].entries[0].sets.map(s => s.w)).toEqual([50, 65])
    expect(S().workouts[0].entries[0].topW).toBe(65)
    expect(listChanges()[0].state).toBe('open')
  })

  it('does not journal what a restore does itself', async () => {
    removeMiddle()
    await restoreChange(listChanges()[0].id)
    await undoRestore(listChanges()[0].id)
    expect(listChanges()).toHaveLength(1)
  })

  it('wins over the older copy of another device in the sync', async () => {
    const other = clone(S())
    removeMiddle()
    const edited = clone(S())
    expect(mergeStates(edited, other).workouts[0].entries[0].sets).toHaveLength(2)
    await restoreChange(listChanges()[0].id)
    const restored = clone(S())
    for (const m of [mergeStates(restored, other), mergeStates(other, restored)]) {
      expect(m.workouts[0].entries[0].sets.map(s => s.w)).toEqual([50, 60, 65])
    }
  })
})
