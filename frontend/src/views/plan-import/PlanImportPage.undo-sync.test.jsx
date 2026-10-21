// @vitest-environment happy-dom
// The import's Undo (T4.4) meets the field-stamp sync, as Plan's Undo does (Plan.undo-sync.test.jsx).
// The routines and custom exercise it took away stay away once another device has pulled the
// import, whichever copy the merge counts as newer; the week it put back is the week from before;
// and an edit another device made meanwhile still wins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { mergeStates, stampChange } from '../../lib/sync-merge.js'
import { parsePlan } from '../../lib/plan-share.js'
import { importPlanWithUndo } from './PlanImportPage.jsx'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const clone = value => JSON.parse(JSON.stringify(value))
const routine = (id, name, ts) => ({ id, name, emoji: null, _ts: ts, ex: [{ id: '0025', sets: 3, reps: 5 }] })
const ids = list => list.map(r => r.id)
const S = () => useStore.getState().S
const undo = () => useUI.getState().runToastAction()

// The copy both devices share before anything happens.
const shared = () => Object.assign(clone(DEF), {
  _ts: 1000,
  routines: [routine('a', 'Push', 900), routine('b', 'Pull', 900)],
  week: { 1: ['a'], 3: ['b'] },
  customEx: [],
})
// Another device's change, stamped the way its store would stamp it.
const change = (prev, fn, wall) => { const next = clone(prev); fn(next); next._ts = stampChange(prev, next, wall); return next }
const file = parsePlan({
  opengym_plan: 1, unit: 'kg', name: 'Upper Lower',
  routines: [{ id: 'u', name: 'Upper A', ex: [{ id: 'c1', sets: 3 }] }, { id: 'l', name: 'Lower A', ex: [{ id: '0025', sets: 3 }] }],
  week: { 2: ['u'], 4: ['l'] },
  customEx: [{ id: 'c1', n: 'Sled push', bp: 'upper legs' }],
}, 'kg')

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: shared(), user: null })
})
afterEach(() => { localStorage.clear() })

describe('Undo after an import the other device has already pulled', () => {
  it('the imported routines and exercise stay gone and the old week stays, in both merge directions', () => {
    const done = importPlanWithUndo(file, { schedule: true })
    const imported = clone(S())
    expect(ids(imported.routines)).toEqual(['a', 'b', ...done.ids])
    expect(imported.week).toEqual({ 2: [done.ids[0]], 4: [done.ids[1]] })
    // The other device pulls the import, then changes something unrelated later.
    const other = change(imported, s => { s.restSec = 75 }, Date.now() + 60_000)
    undo()
    const here = S()
    expect(ids(here.routines)).toEqual(['a', 'b'])
    expect(here.customEx).toEqual([])
    expect(here.week).toEqual({ 1: ['a'], 3: ['b'] })
    for (const id of done.ids) expect(here.deleted.routines[id]).toBeGreaterThan(0)
    for (const m of [mergeStates(here, other), mergeStates(other, here)]) {
      expect(ids(m.routines)).toEqual(['a', 'b'])
      expect((m.customEx || []).map(c => c.id)).not.toContain(done.exIds[0])
      expect(m.week).toEqual({ 1: ['a'], 3: ['b'] })
      expect(m.restSec).toBe(75)
      // and the next merge with the server's copy of the import does not bring them back either
      expect(ids(mergeStates(m, imported).routines)).toEqual(['a', 'b'])
    }
  })

  it('a weekday the other device changed before it saw the import keeps its change', () => {
    const before = clone(S())
    // A minute before the import: a stamp equal to the import's own is a tie the Undo wins (undoPick).
    const combined = change(before, s => { s.week[1] = ['a', 'b'] }, Date.now() - 60_000)
    importPlanWithUndo(file, { schedule: true })
    undo()
    const m = mergeStates(S(), combined)
    expect(m.week[1]).toEqual(['a', 'b'])
    expect(m.week[3]).toEqual(['b'])
  })

  it('a custom exercise logged with by then stays, while its routine goes', () => {
    const done = importPlanWithUndo(file)
    const sled = done.exIds[0]
    useStore.getState().update(s => { s.workouts = [...(s.workouts || []), { id: 'w1', d: '2026-10-20', start: 1, end: 2, name: 'Upper A', entries: [{ id: sled, sets: [] }], prs: [] }] })
    undo()
    expect(ids(S().routines)).toEqual(['a', 'b'])
    expect(S().customEx.map(c => c.id)).toEqual([sled])
  })
})
