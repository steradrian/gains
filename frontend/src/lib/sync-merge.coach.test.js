import { describe, expect, it } from 'vitest'
import { PLAN_CHANGE_MAX } from './coach-plan-changes.js'
import { mergeStates } from './sync-merge.js'

// Eat coach m1: S.coach.planChanges is merged on its own. `coach` is stamped as one slice, so
// without that the copy that won it would drop the other device's stamps.
const base = (over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: {}, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], _ts: 0, ...over,
})
const stamp = (id, at, extra = {}) => ({ id, at, type: 'add-routine', routineName: 'R' + id, ...extra })
const coachWith = (planChanges, extra = {}) => ({ cadence: 'off', log: [], snapshots: [], planChanges, ...extra })
const ids = S => S.coach.planChanges.map(x => x.id)

describe('mergeStates: coach plan-change stamps', () => {
  it('keeps the stamps of both copies, whichever is newer', () => {
    const phone = base({ _ts: 100, coach: coachWith([stamp('a', 10)]), edited: { coach: 100 } })
    const desk = base({ _ts: 200, coach: coachWith([stamp('b', 20)], { cadence: 'weekly' }), edited: { coach: 200 } })
    for (const m of [mergeStates(phone, desk), mergeStates(desk, phone)]) {
      expect(ids(m)).toEqual(['a', 'b'])
      // The rest of the slice still follows the newer stamp.
      expect(m.coach.cadence).toBe('weekly')
    }
  })

  it('does not duplicate a stamp both copies hold', () => {
    const a = base({ _ts: 1, coach: coachWith([stamp('a', 10), stamp('b', 20)]) })
    const b = base({ _ts: 2, coach: coachWith([stamp('b', 20), stamp('c', 30)]) })
    expect(ids(mergeStates(a, b))).toEqual(['a', 'b', 'c'])
    expect(ids(mergeStates(b, a))).toEqual(['a', 'b', 'c'])
  })

  it('a revert on one device holds against the other copy still carrying the stamp', () => {
    const undone = base({ _ts: 200, coach: coachWith([stamp('a', 10, { reverted: true })]) })
    const stale = base({ _ts: 100, coach: coachWith([stamp('a', 10)]) })
    for (const m of [mergeStates(undone, stale), mergeStates(stale, undone)]) {
      expect(m.coach.planChanges).toEqual([stamp('a', 10, { reverted: true })])
    }
  })

  it('stays capped', () => {
    const a = base({ _ts: 1, coach: coachWith(Array.from({ length: PLAN_CHANGE_MAX }, (_, i) => stamp('a' + i, i))) })
    const b = base({ _ts: 2, coach: coachWith(Array.from({ length: PLAN_CHANGE_MAX }, (_, i) => stamp('b' + i, 1000 + i))) })
    const m = mergeStates(a, b)
    expect(m.coach.planChanges).toHaveLength(PLAN_CHANGE_MAX)
    expect(m.coach.planChanges.every(x => x.id.startsWith('b'))).toBe(true)
  })

  it('a copy from before the field existed merges as before', () => {
    const old = base({ _ts: 1, coach: { cadence: 'off', log: [], snapshots: [] } })
    const next = base({ _ts: 2, coach: coachWith([stamp('a', 10)]) })
    expect(ids(mergeStates(old, next))).toEqual(['a'])
    expect(ids(mergeStates(next, old))).toEqual(['a'])
    expect(mergeStates(base({ _ts: 1 }), base({ _ts: 2 })).coach).toBeUndefined()
  })

  it('a sign-in (prefer) keeps the preferred side only', () => {
    const server = base({ _ts: 1, coach: coachWith([stamp('a', 10)]) })
    const guest = base({ _ts: 2, coach: coachWith([stamp('g', 20)]) })
    expect(ids(mergeStates(server, guest, { prefer: 'a' }))).toEqual(['a'])
  })
})
