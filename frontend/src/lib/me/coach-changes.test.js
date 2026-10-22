// @vitest-environment happy-dom
// The `coach-move` journal source: read from S.coach.planChanges, undone with the Coach's own
// revertLast, never copied.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { applyChangeSet, emptyCoach } from '../coach.js'
import { clearChanges, listChanges, recordChange, restoreChange, undoRestore } from '../recent-changes.js'
import { removeEntries } from '../recent-changes-store.js'
import { mergeStates } from '../sync-merge.js'
import { COACH_MOVE, coachMoves } from './coach-changes.js'
import '../recent-changes-kinds.js'

vi.mock('../api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

const DAY = 86400000
const NOW = new Date(2026, 9, 22, 12).getTime()
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const week = (id, weekday, after) => ({ id, type: 'week', target: { weekday }, before: null, after, why: 'w' })
const proposal = (changes, id = 'p1') => ({ id, kind: 'review', summary: 's', changes })
const apply = (changes, id) => useStore.getState().update(s => { applyChangeSet(s, proposal(changes, id), changes.map(c => c.id)) })
const ids = () => listChanges().filter(r => r.kind === COACH_MOVE).map(r => r.id)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  removeEntries()
  useStore.setState({
    S: Object.assign(clone(DEF), {
      unit: 'kg', workouts: [], coach: emptyCoach(),
      routines: [
        { id: 'r1', name: 'Push', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }] },
        { id: 'r2', name: 'Legs', ex: [{ id: '0002', sets: 4, reps: 6, mode: 'reps' }] },
      ],
      week: { 1: ['r1'], 3: ['r2'] },
    }),
    user: null,
  })
})
afterEach(() => { vi.useRealTimers(); localStorage.clear(); removeEntries() })

describe('listing', () => {
  it('lists the last change-set\'s changes with structured facts and an Undo', () => {
    apply([
      week('c1', 5, 'r2'),                                   // Legs: Wednesday -> Friday
      week('c2', 1, 'rest'),                                 // Monday (Push) becomes a rest day
      { id: 'c3', type: 'rename-routine', target: { routineId: 'r1' }, before: 'Push', after: 'Push A' },
    ])
    const rows = listChanges().filter(r => r.kind === COACH_MOVE)
    expect(rows.map(r => r.id).sort()).toEqual(['coach:p1:c1', 'coach:p1:c2', 'coach:p1:c3'])
    const by = Object.fromEntries(rows.map(r => [r.id, r]))
    expect(by['coach:p1:c1']).toMatchObject({ subject: 'Legs', action: 'undo', state: 'open', day: '2026-10-22', at: NOW, facts: { change: 'moved', from: 3, to: 5, weekday: 5 } })
    expect(by['coach:p1:c2']).toMatchObject({ subject: 'Push', facts: { change: 'rest-day', from: 1, to: null } })
    expect(by['coach:p1:c3']).toMatchObject({ subject: 'Push A', facts: { change: 'renamed', from: 'Push', to: 'Push A' } })
    expect('snapshot' in by['coach:p1:c1']).toBe(false)
  })

  it('a routine named for another day moves from where it was; added and removed carry the routine name', () => {
    apply([
      week('c1', 6, 'r1'),
      { id: 'c2', type: 'add-routine', target: {}, after: { name: 'Pull B', ex: [{ id: '0001' }] } },
      { id: 'c3', type: 'remove-routine', target: { routineId: 'r2' }, before: null },
    ])
    const by = Object.fromEntries(listChanges().map(r => [r.id, r]))
    // Push was on Monday before, so naming it for Saturday is a move from Monday.
    expect(by['coach:p1:c1'].facts).toMatchObject({ change: 'moved', from: 1, to: 6 })
    expect(by['coach:p1:c2']).toMatchObject({ subject: 'Pull B', facts: { change: 'added' } })
    expect(by['coach:p1:c3']).toMatchObject({ subject: 'Legs', facts: { change: 'removed' } })
  })

  it('a routine with no day before is set on the day', () => {
    useStore.setState({ S: { ...S(), week: { 1: ['r1'] } } })
    apply([week('c1', 4, 'r2')])
    expect(listChanges()[0]).toMatchObject({ subject: 'Legs', facts: { change: 'set', from: null, to: 4 } })
  })

  it('lists only the change-set the Coach can still undo', () => {
    apply([week('c1', 5, 'r2')], 'p1')
    apply([week('c2', 4, 'r1')], 'p2')
    expect(ids()).toEqual(['coach:p2:c2'])
  })

  it('is empty when the Coach has no log (coming soon, or never used)', () => {
    expect(listChanges()).toEqual([])
    useStore.setState({ S: { ...S(), coach: undefined } })
    expect(listChanges()).toEqual([])
    expect(coachMoves({ coach: { planChanges: [], snapshots: [] } })).toEqual([])
  })

  it('keeps the last 7 days only', () => {
    apply([week('c1', 5, 'r2')])
    vi.setSystemTime(NOW + 6 * DAY)
    expect(ids()).toEqual(['coach:p1:c1'])
    vi.setSystemTime(NOW + 8 * DAY)
    expect(ids()).toEqual([])
  })

  it('merges with the journal\'s own entries, newest first', () => {
    apply([week('c1', 5, 'r2')])
    vi.setSystemTime(NOW + 1000)
    const own = recordChange({ kind: 'routine-delete', subject: 'Core', snapshot: {} })
    vi.setSystemTime(NOW + 2000)
    expect(listChanges().map(r => r.id)).toEqual([own, 'coach:p1:c1'])
  })
})

describe('Undo', () => {
  it('runs the Coach\'s own revert: the plan is back, the rows leave, the stamps stay as tombstones', async () => {
    apply([week('c1', 5, 'r2'), week('c2', 1, 'rest')])
    expect(S().week).toEqual({ 3: ['r2'], 5: ['r2'] })
    expect(await restoreChange('coach:p1:c1')).toEqual({ ok: true })
    expect(S().week).toEqual({ 1: ['r1'], 3: ['r2'] })
    expect(ids()).toEqual([])
    expect(S().coach.planChanges.map(x => [x.id, x.reverted])).toEqual([['p1:c1', true], ['p1:c2', true]])
    expect(S().coach.log.at(-1)).toMatchObject({ kind: 'revert', proposalId: 'p1' })
    expect(S().coach.snapshots).toEqual([])
  })

  it('answers gone for a row that is no longer there, and a second tap does nothing', async () => {
    apply([week('c1', 5, 'r2')])
    expect(await restoreChange('coach:p1:nope')).toEqual({ ok: false, reason: 'gone' })
    expect(await restoreChange('coach:p1:c1')).toEqual({ ok: true })
    expect(await restoreChange('coach:p1:c1')).toEqual({ ok: false, reason: 'gone' })
    expect(S().week).toEqual({ 1: ['r1'], 3: ['r2'] })
  })

  it('after the last change-set is undone, the one before it can be', async () => {
    apply([week('c1', 5, 'r2')], 'p1')
    apply([week('c2', 4, 'r1')], 'p2')
    expect(await restoreChange('coach:p2:c2')).toEqual({ ok: true })
    expect(ids()).toEqual(['coach:p1:c1'])
    expect(await restoreChange('coach:p1:c1')).toEqual({ ok: true })
    expect(S().week).toEqual({ 1: ['r1'], 3: ['r2'] })
  })

  it('has no undo of its own: the Coach has none', async () => {
    apply([week('c1', 5, 'r2')])
    await restoreChange('coach:p1:c1')
    expect(await undoRestore('coach:p1:c1')).toEqual({ ok: false })
  })

  it('does not run after the 7 days', async () => {
    apply([week('c1', 5, 'r2')])
    vi.setSystemTime(NOW + 8 * DAY)
    expect(await restoreChange('coach:p1:c1')).toEqual({ ok: false, reason: 'gone' })
    expect(S().week).toEqual({ 1: ['r1'], 3: ['r2'], 5: ['r2'] })
  })
})

describe('clearing and syncing', () => {
  it('clearChanges leaves the Coach\'s own log alone', () => {
    apply([week('c1', 5, 'r2')])
    recordChange({ kind: 'routine-delete', subject: 'Core', snapshot: {} })
    const stamps = clone(S().coach.planChanges)
    clearChanges()
    expect(S().coach.planChanges).toEqual(stamps)
    expect(ids()).toEqual(['coach:p1:c1'])
    expect(listChanges()).toHaveLength(1)
  })

  it('an Undo on one device holds against the other copy still carrying the stamps, in both merge orders', async () => {
    apply([week('c1', 5, 'r2')])
    const stale = clone(S())
    await restoreChange('coach:p1:c1')
    const undone = clone(S())
    const a = { ...undone, _ts: 200 }
    const b = { ...stale, _ts: 100 }
    for (const m of [mergeStates(a, b), mergeStates(b, a)]) {
      expect(m.coach.planChanges.map(x => [x.id, x.reverted])).toEqual([['p1:c1', true]])
      expect(coachMoves(m)).toEqual([])
    }
  })

  it('the other device sees the same row until it merges the Undo', () => {
    apply([week('c1', 5, 'r2')])
    const other = clone(S())
    expect(coachMoves(other).map(e => e.id)).toEqual(['coach:p1:c1'])
  })
})
