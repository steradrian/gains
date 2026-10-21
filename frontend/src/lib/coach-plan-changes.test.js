import { describe, expect, it } from 'vitest'
import { applyChangeSet, applyCreatedPlan, emptyCoach, revertLast } from './coach.js'
import {
  PLAN_CHANGE_DAYS, PLAN_CHANGE_MAX, addPlanChanges, cleanPlanChange, mergePlanChanges, planChangeOf, revertPlanChanges,
} from './coach-plan-changes.js'
import { FEED_DAYS } from './notifications/feed.js'

const DAY = 86400000
const NOW = new Date(2026, 9, 21, 12).getTime()

const state = (over = {}) => ({
  unit: 'kg', lang: 'en', customEx: [], workouts: [], bodyweight: [], exWeights: {}, dayPlan: {},
  routines: [
    { id: 'r1', name: 'Push', emoji: '💪', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }] },
    { id: 'r2', name: 'Legs', ex: [{ id: '0002', sets: 4, reps: 6, mode: 'reps' }] },
  ],
  week: { 1: ['r1'], 3: ['r2'] },
  coach: { ...emptyCoach(), cadence: 'off' },
  ...over,
})
const draft = over => JSON.parse(JSON.stringify(state(over)))
const proposal = (changes, id = 'p1') => ({ id, kind: 'review', summary: 's', changes })
const week = (id, weekday, after, extra = {}) => ({ id, type: 'week', target: { weekday }, before: null, after, why: 'w', ...extra })
const stampsOf = s => s.coach.planChanges || []

describe('coach plan-change stamps: writing', () => {
  it('a week change stamps the weekday with the routine name resolved at the write', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 4, 'r2')]), ['c1'])
    expect(stampsOf(s)).toEqual([{ id: 'p1:c1', at: expect.any(Number), type: 'week', weekday: 4, routineName: 'Legs' }])
    // A later rename does not touch the stamp.
    s.routines[1].name = 'Legs and glutes'
    expect(stampsOf(s)[0].routineName).toBe('Legs')
  })

  it('a rest day has no routine name', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 1, 'rest')]), ['c1'])
    expect(stampsOf(s)).toEqual([{ id: 'p1:c1', at: expect.any(Number), type: 'week', weekday: 1 }])
  })

  it('add, remove and rename routine stamp the names as they were', () => {
    const s = draft()
    applyChangeSet(s, proposal([
      { id: 'a', type: 'add-routine', target: {}, after: { name: 'Pull B', ex: [{ id: '0001' }] } },
      { id: 'b', type: 'remove-routine', target: { routineId: 'r2' }, before: null },
      { id: 'c', type: 'rename-routine', target: { routineId: 'r1' }, before: 'Push', after: 'Push A' },
    ]), ['a', 'b', 'c'])
    const by = Object.fromEntries(stampsOf(s).map(x => [x.id, x]))
    expect(by['p1:a']).toMatchObject({ type: 'add-routine', routineName: 'Pull B' })
    expect(by['p1:b']).toMatchObject({ type: 'remove-routine', routineName: 'Legs' })
    expect(by['p1:c']).toMatchObject({ type: 'rename-routine', from: 'Push', to: 'Push A' })
  })

  it('exercise-level edits are not stamped', () => {
    const s = draft()
    applyChangeSet(s, proposal([{ id: 'c1', type: 'sets', target: { routineId: 'r1', exId: '0001' }, before: 3, after: 4 }]), ['c1'])
    expect(stampsOf(s)).toEqual([])
    expect(s.routines[0].ex[0].sets).toBe(4)
  })

  it('a rejected change and a stale one leave no stamp', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 4, 'r2'), week('c2', 5, 'r1', { status: 'stale' }), week('c3', 6, 'r1')]), ['c1', 'c2'])
    expect(stampsOf(s).map(x => x.id)).toEqual(['p1:c1'])
  })

  it('a change that throws leaves no stamp, even on a draft the caller keeps', () => {
    const s = draft()
    const bad = { id: 'c2', type: 'sets', target: { routineId: 'nope', exId: '0001' }, before: 3, after: 4 }
    expect(() => applyChangeSet(s, proposal([week('c1', 4, 'r2'), bad]), ['c1', 'c2'])).toThrow()
    expect(stampsOf(s)).toEqual([])
  })

  it('a week change naming a routine that does not exist is not stamped', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 4, 'ghost')]), ['c1'])
    expect(stampsOf(s)).toEqual([])
  })

  it('ids are stable per proposal and change, and a repeat apply does not duplicate', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 4, 'r2')]), ['c1'])
    const first = stampsOf(s)[0]
    applyChangeSet(s, proposal([week('c1', 4, 'r2')]), ['c1'])
    expect(stampsOf(s)).toEqual([first])
    applyChangeSet(s, proposal([week('c1', 4, 'r2')], 'p2'), ['c1'])
    expect(stampsOf(s).map(x => x.id)).toEqual(['p1:c1', 'p2:c1'])
  })

  it('a created plan stamps one create line', () => {
    const s = draft()
    const bundle = { opengym_plan: 1, name: 'Coach plan', week: { 1: 'x1' }, routines: [{ id: 'x1', name: 'A', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }] }], customEx: [] }
    applyCreatedPlan(s, { id: 'p9', kind: 'create', bundle }, { schedule: true })
    expect(stampsOf(s)).toEqual([{ id: 'p9:plan', at: expect.any(Number), type: 'create' }])
  })

  it('nothing is written back for changes applied before this existed', () => {
    const s = draft()
    expect(stampsOf(s)).toEqual([])
  })
})

describe('coach plan-change stamps: the list', () => {
  const stamp = (id, at, extra = {}) => ({ id, at, type: 'add-routine', routineName: 'R', ...extra })

  it('planChangeOf ignores a change it cannot name', () => {
    const s = state()
    const o = { proposalId: 'p', at: 1 }
    expect(planChangeOf(s, week('c', 9, 'r1'), o)).toBeNull()
    expect(planChangeOf(s, { id: 'c', type: 'remove-routine', target: { routineId: 'r1' } }, o)).toBeNull()
    expect(planChangeOf(s, { id: 'c', type: 'rename-routine', after: 'X' }, { ...o, prior: '' })).toBeNull()
    expect(planChangeOf(s, week('c', 2, 'r1'), { at: 1 })).toBeNull()
  })

  it('cleanPlanChange keeps the known shape and drops what is malformed', () => {
    expect(cleanPlanChange({ id: 'a', at: 1, type: 'week', weekday: 2, junk: 1 })).toEqual({ id: 'a', at: 1, type: 'week', weekday: 2 })
    expect(cleanPlanChange({ id: 'a', at: 1, type: 'week', weekday: 7 })).toBeNull()
    expect(cleanPlanChange({ id: 'a', at: 1, type: 'rename-routine', from: 'X' })).toBeNull()
    expect(cleanPlanChange({ id: 'a', at: 1, type: 'mystery' })).toBeNull()
    expect(cleanPlanChange({ at: 1, type: 'create' })).toBeNull()
    expect(cleanPlanChange(null)).toBeNull()
  })

  it('the cap drops the oldest past PLAN_CHANGE_MAX and the stamps older than the window', () => {
    const c = emptyCoach()
    const many = Array.from({ length: PLAN_CHANGE_MAX + 20 }, (_, i) => stamp('s' + i, NOW - 60_000 + i))
    addPlanChanges(c, [stamp('old', NOW - (PLAN_CHANGE_DAYS + 1) * DAY), ...many], NOW)
    expect(c.planChanges).toHaveLength(PLAN_CHANGE_MAX)
    expect(c.planChanges[0].id).toBe('s20')
    expect(c.planChanges.at(-1).id).toBe('s' + (PLAN_CHANGE_MAX + 19))
    expect(c.planChanges.some(x => x.id === 'old')).toBe(false)
  })

  it('an old stamp already in the list goes on the next write', () => {
    const c = { planChanges: [stamp('old', NOW - (PLAN_CHANGE_DAYS + 1) * DAY)] }
    addPlanChanges(c, [stamp('new', NOW)], NOW)
    expect(c.planChanges.map(x => x.id)).toEqual(['new'])
  })

  it('the window is the feed window', () => {
    expect(PLAN_CHANGE_DAYS).toBe(FEED_DAYS)
  })

  it('mergePlanChanges is the union by id in time order, a reverted mark from either side kept', () => {
    const a = [stamp('x', 10), stamp('y', 30, { reverted: true })]
    const b = [stamp('y', 30), stamp('z', 20), stamp('x', 10)]
    const merged = mergePlanChanges(a, b)
    expect(merged.map(x => x.id)).toEqual(['x', 'z', 'y'])
    expect(merged.find(x => x.id === 'y').reverted).toBe(true)
    expect(mergePlanChanges(b, a)).toEqual(merged)
    expect(mergePlanChanges(undefined, null)).toEqual([])
  })

  it('revertPlanChanges marks only the proposal asked for', () => {
    const c = { planChanges: [stamp('p1:a', 1), stamp('p1:b', 2), stamp('p10:a', 3)] }
    revertPlanChanges(c, 'p1')
    expect(c.planChanges.map(x => !!x.reverted)).toEqual([true, true, false])
    revertPlanChanges(c, null)
    expect(c.planChanges.map(x => !!x.reverted)).toEqual([true, true, false])
  })
})

describe('coach plan-change stamps: revert', () => {
  it('revertLast marks the undone change reverted and leaves other proposals alone', () => {
    const s = draft()
    applyChangeSet(s, proposal([week('c1', 4, 'r2')], 'p1'), ['c1'])
    applyChangeSet(s, proposal([week('c1', 5, 'r1')], 'p2'), ['c1'])
    expect(revertLast(s)).toBe(true)
    const by = Object.fromEntries(stampsOf(s).map(x => [x.id, x]))
    expect(by['p2:c1'].reverted).toBe(true)
    expect(by['p1:c1'].reverted).toBeUndefined()
  })
})
