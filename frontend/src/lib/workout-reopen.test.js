// @vitest-environment happy-dom
// Reopen (owner question 6, W2.1): the saved workout back as the running session, the record out
// through the deletion stamps, the confirmed weights and the rotation's refill put back.
import { beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { mergeStates, stampChange } from './sync-merge.js'
import { canReopen, reopenInto, reopenWorkout, REOPEN_MS } from './workout-reopen.js'

const clone = v => JSON.parse(JSON.stringify(v))
const AT = Date.parse('2026-10-18T18:34:00')
const running = { id: 'w1', d: '2026-10-18', start: AT - 52 * 60000, routineIds: ['push'], name: 'Push A', cur: 2, entries: [{ id: '0025', target: { sets: 1, reps: 8 }, sets: [{ w: 80, r: 8, done: true, at: AT - 60000 }] }] }
const saved = { id: 'w1', d: '2026-10-18', start: running.start, end: AT, routineIds: ['push'], name: 'Push A', entries: [{ id: '0025', sets: [{ w: 80, r: 8, done: true, at: AT - 60000 }] }], _ts: AT }

// The state right after the save, and what the save's snapshot holds.
const afterSave = () => ({
  ...clone(DEF), _ts: AT, active: null, workouts: [clone(saved)],
  exWeights: { '0025': { w: 80, d: '2026-10-18' }, '0043': { w: 100, d: '2026-10-18' } },
  queue: { ids: ['pull', 'legs'], since: AT + 1, startsOn: '2026-10-19', label: '' },
  dayPlan: { '2026-10-25': 'other' },
})
const snapshot = (over = {}) => ({
  at: AT, workoutId: 'w1', active: clone(running),
  exWeights: { '0025': { w: 77.5, d: '2026-10-11' }, '0043': null },
  rotation: { queue: { ids: ['push', 'pull', 'legs'], since: AT - 86400000, startsOn: '2026-10-18', label: '' }, pins: { '2026-10-20': 'pull' } },
  ...over,
})

describe('reopenInto', () => {
  it('puts the session back as it was and the record, weights and refill as before the save', () => {
    const s = afterSave()
    expect(reopenInto(s, snapshot())).toBe(true)
    expect(s.active).toEqual(running)
    expect(s.workouts).toEqual([])
    expect(s.exWeights).toEqual({ '0025': { w: 77.5, d: '2026-10-11' } })
    expect(s.queue.ids).toEqual(['push', 'pull', 'legs'])
    expect(s.dayPlan).toEqual({ '2026-10-25': 'other', '2026-10-20': 'pull' })
  })

  it('a save that changed no weights and refilled nothing leaves them alone', () => {
    const s = afterSave()
    reopenInto(s, snapshot({ exWeights: {}, rotation: null }))
    expect(s.exWeights['0043']).toEqual({ w: 100, d: '2026-10-18' })
    expect(s.queue.ids).toEqual(['pull', 'legs'])
  })

  it('changes nothing while another session runs or once the record is gone', () => {
    const busy = { ...afterSave(), active: { id: 'other', entries: [] } }
    expect(reopenInto(busy, snapshot())).toBe(false)
    expect(busy.workouts).toHaveLength(1)
    const gone = { ...afterSave(), workouts: [] }
    expect(reopenInto(gone, snapshot())).toBe(false)
    expect(gone.active).toBeNull()
  })

  it('a device that already pulled the saved workout drops it once the reopen syncs', () => {
    const prev = afterSave()
    const other = clone(prev)           // the second device, which pulled the save
    const next = clone(prev)
    reopenInto(next, snapshot())
    next._ts = stampChange(prev, next, AT + 5000)
    expect(Number(next.deleted.workouts.w1)).toBeGreaterThan(saved._ts)
    expect(mergeStates(next, other).workouts.map(w => w.id)).toEqual([])
    expect(mergeStates(other, next).workouts.map(w => w.id)).toEqual([])
  })

  it('finishing the reopened session again brings the workout back everywhere', () => {
    const prev = afterSave()
    const other = clone(prev)
    const reopened = clone(prev)
    reopenInto(reopened, snapshot())
    reopened._ts = stampChange(prev, reopened, AT + 5000)
    const refinished = clone(reopened)
    refinished.active = null
    refinished.workouts = [{ ...clone(saved), end: AT + 600000, _ts: AT + 600000 }]
    refinished._ts = stampChange(reopened, refinished, AT + 600000)
    expect(mergeStates(refinished, other).workouts.map(w => w.end)).toEqual([AT + 600000])
  })
})

describe('reopenWorkout', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ S: afterSave(), user: null })
  })

  it('reopens within 10 s, through the store, with the removal stamped', () => {
    expect(reopenWorkout(snapshot(), AT + REOPEN_MS)).toBe(true)
    const S = useStore.getState().S
    expect(S.active.id).toBe('w1')
    expect(S.active.cur).toBe(2)
    expect(S.workouts).toEqual([])
    expect(Number(S.deleted?.workouts?.w1)).toBeGreaterThan(0)
  })

  it('not after 10 s, and not twice', () => {
    expect(canReopen(snapshot(), AT + REOPEN_MS + 1)).toBe(false)
    expect(reopenWorkout(snapshot(), AT + REOPEN_MS + 1)).toBe(false)
    expect(useStore.getState().S.workouts).toHaveLength(1)
    expect(reopenWorkout(snapshot(), AT + 1000)).toBe(true)
    expect(reopenWorkout(snapshot(), AT + 2000)).toBe(false)
  })

  it('no snapshot (a workout logged into the past) never reopens', () => {
    expect(canReopen(null)).toBe(false)
    expect(reopenWorkout(null)).toBe(false)
  })
})
