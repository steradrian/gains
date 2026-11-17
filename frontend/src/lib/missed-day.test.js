// A missed planned day (PR02 T2.8, T2.12, T2.13): which day Train names, what Move to today and
// Skip it write, and that Undo puts the plan and the seen state back exactly.
import { describe, expect, it } from 'vitest'
import { effectiveRoutineIds } from './history.js'
import { missedDay, movePlan, moveToToday, movingId, nextFreeDay, restDay, restPlan, seenOn, skipMissed, skippedOn, withSeen } from './missed-day.js'

// Sun 18 Oct 2026 is today. The plan: Push on Sundays, Legs on Mondays and Fridays, Pull on Wednesdays.
const TODAY = '2026-10-18'
const WED = '2026-10-14', THU = '2026-10-15', FRI = '2026-10-16', MON = '2026-10-19', TUE = '2026-10-20'
const clone = o => JSON.parse(JSON.stringify(o))
const routine = (id, name) => ({ id, name, ex: [{ id: '0025', sets: 3 }] })
const workout = (id, d, routineIds) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T11:00:00').getTime(), routineIds, entries: [] })
const S = over => ({
  routines: [routine('push', 'Push A'), routine('pull', 'Pull A'), routine('legs', 'Legs')],
  week: { 0: ['push'], 1: ['legs'], 3: ['pull'], 5: ['legs'] },
  dayPlan: {}, dayNotes: {}, missedSeen: {}, queue: null,
  workouts: [workout('w1', WED, ['pull'])],
  ...over,
})

describe('missedDay', () => {
  it('names the most recent planned day without a workout, and what it owed', () => {
    expect(missedDay(S(), TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
  })

  it('is nothing before the first workout: a plan made today does not start out missed', () => {
    expect(missedDay(S({ workouts: [] }), TODAY)).toBeNull()
    expect(missedDay(S({ workouts: [workout('w', '2026-10-17', ['push'])] }), TODAY)).toBeNull()
  })

  it('is asked once: a seen day, or one with a day note, puts the banner away, and no older miss takes its place', () => {
    expect(missedDay(S({ missedSeen: withSeen({}, FRI, true, 5) }), TODAY)).toBeNull()
    expect(missedDay(S({ dayNotes: { [FRI]: { tag: 'sick', _ts: 1 } } }), TODAY)).toBeNull()
    // Wednesday was missed too (the first workout was a week earlier): Friday still speaks for both.
    const older = S({ workouts: [workout('w0', '2026-10-07', ['pull'])], missedSeen: withSeen({}, FRI, true, 5) })
    expect(missedDay(older, TODAY)).toBeNull()
  })

  it('a cleared seen entry (an Undo) asks again', () => {
    expect(missedDay(S({ missedSeen: withSeen({}, FRI, false, 9) }), TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
  })

  it('a logged day is not missed, and the search goes on behind it', () => {
    const state = S({ workouts: [workout('w0', '2026-10-12', ['legs']), workout('w2', FRI, ['legs'])] })
    expect(missedDay(state, TODAY)).toEqual({ iso: WED, ids: ['pull'] })
  })

  it('looks back a week, no further', () => {
    const state = S({ week: {}, dayPlan: { '2026-10-10': 'legs' }, workouts: [workout('w0', '2026-10-01', ['push'])] })
    expect(missedDay(state, '2026-10-17')).toEqual({ iso: '2026-10-10', ids: ['legs'] })
    expect(missedDay(state, TODAY)).toBeNull()
  })

  it('is nothing when today holds the same routines anyway', () => {
    expect(missedDay(S({ dayPlan: { [TODAY]: 'legs' } }), TODAY)).toBeNull()
  })

  it('a coach week or rotation session is never missed: the queue floats it to the next day you train', () => {
    const since = new Date('2026-10-15T00:00:00').getTime()
    const state = S({ week: {}, queue: { ids: ['legs', 'push'], since, startsOn: THU }, dayPlan: { [FRI]: 'legs' } })
    expect(missedDay(state, TODAY)).toBeNull()
    expect(effectiveRoutineIds(state, TODAY, TODAY)).toEqual(['legs'])
  })
})

describe('Move to today', () => {
  it('says first what it would do: Legs today, Push A to the next free day', () => {
    expect(nextFreeDay(S(), TODAY)).toBe(TUE)
    expect(movePlan(S(), FRI, TODAY)).toEqual({ iso: FRI, id: 'legs', displaced: { ids: ['push'], id: 'push', floats: false, to: TUE } })
  })

  it('a free day is one with nothing planned, no rest set on purpose and no note', () => {
    expect(nextFreeDay(S({ dayPlan: { [TUE]: 'rest' } }), TODAY)).toBe('2026-10-22')
    expect(nextFreeDay(S({ dayPlan: { [TUE]: 'rest' }, dayNotes: { '2026-10-22': { tag: 'travel', _ts: 1 } } }), TODAY)).toBe('2026-10-24')
  })

  it('writes today and the free day, marks the missed day seen, and leaves every log alone', () => {
    const s = S()
    const before = clone(s.workouts)
    const moved = moveToToday(s, FRI, TODAY, 100)
    expect(moved).toMatchObject({ id: 'legs', displaced: { ids: ['push'], to: TUE } })
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs', [TUE]: 'push' })
    expect(effectiveRoutineIds(s, TODAY, TODAY)).toEqual(['legs'])
    expect(effectiveRoutineIds(s, TUE, TODAY)).toEqual(['push'])
    expect(seenOn(s, FRI)).toBe(true)
    expect(s.missedSeen[FRI]).toEqual({ seen: true, _ts: 100 })
    expect(s.workouts).toEqual(before)
    expect(missedDay(s, TODAY)).toBeNull()
  })

  it('Undo puts back exactly the plan days it wrote, absent ones absent, and asks again', () => {
    const s = S({ dayPlan: { [TODAY]: 'pull', '2026-10-25': 'rest' } })
    const was = clone(s.dayPlan)
    const moved = moveToToday(s, FRI, TODAY, 100)
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs', [TUE]: 'pull', '2026-10-25': 'rest' })
    moved.undo(s, 200)
    expect(s.dayPlan).toEqual(was)
    expect(Object.hasOwn(s.dayPlan, TUE)).toBe(false)
    expect(s.missedSeen[FRI]).toEqual({ _ts: 200 })
    expect(missedDay(s, TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
  })

  it('Undo brings back a seen entry that was there before', () => {
    const s = S({ missedSeen: { [FRI]: { _ts: 50 } } })
    const moved = moveToToday(s, FRI, TODAY, 100)
    moved.undo(s, 200)
    expect(s.missedSeen[FRI]).toEqual({ _ts: 50 })
  })

  it('with today free, only today is written', () => {
    const s = S({ week: { 1: ['legs'], 5: ['legs'] } })
    const moved = moveToToday(s, FRI, TODAY, 1)
    expect(moved.displaced).toBeNull()
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs' })
  })

  it('with no free day ahead, today’s session has nowhere to go and only today is written', () => {
    const every = { 0: ['push'], 1: ['legs'], 2: ['pull'], 3: ['pull'], 4: ['pull'], 5: ['legs'], 6: ['pull'] }
    const s = S({ week: every })
    const moved = moveToToday(s, FRI, TODAY, 1)
    expect(moved.displaced).toEqual({ ids: ['push'], id: 'push', floats: false, to: null })
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs' })
  })

  it('in rotation mode, today’s queue session is not written anywhere: the queue floats it to tomorrow', () => {
    const since = new Date('2026-10-15T00:00:00').getTime()
    const s = S({ week: { 5: ['legs'] }, queue: { ids: ['push', 'pull'], since, startsOn: THU, rotationId: 'rot' }, rotation: { id: 'rot', sequence: ['push', 'pull'] } })
    expect(effectiveRoutineIds(s, TODAY, TODAY)).toEqual(['push'])
    const moved = moveToToday(s, FRI, TODAY, 1)
    expect(moved.displaced).toEqual({ ids: ['push'], id: 'push', floats: true, to: MON })
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs' })
    expect(effectiveRoutineIds(s, TODAY, TODAY)).toEqual(['legs'])
    // Tomorrow the queue's next session is Push A again.
    expect(effectiveRoutineIds(s, MON, MON)).toEqual(['push'])
  })

  it('is null for a day that owes nothing any more', () => {
    const s = S({ workouts: [workout('w', FRI, ['legs'])] })
    expect(moveToToday(s, '2026-10-17', TODAY, 1)).toBeNull()
    expect(s.dayPlan).toEqual({})
  })
})

describe('what today already trained', () => {
  const run = (routineIds, extra = {}) => ({ id: 'a', d: TODAY, start: 1, routineIds, entries: [], ...extra })

  it('today logged: Move brings the missed routine in and moves nothing out, so nothing is trained twice', () => {
    const s = S({ workouts: [workout('w1', WED, ['pull']), workout('w2', TODAY, ['push'])] })
    expect(missedDay(s, TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
    expect(movePlan(s, FRI, TODAY)).toEqual({ iso: FRI, id: 'legs', displaced: null })
    moveToToday(s, FRI, TODAY, 1)
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs' })
  })

  it('the missed routine already trained today: nothing is missed any more', () => {
    const s = S({ workouts: [workout('w1', WED, ['pull']), workout('w2', TODAY, ['legs'])] })
    expect(missedDay(s, TODAY)).toBeNull()
    expect(movePlan(s, FRI, TODAY)).toBeNull()
  })

  it('a workout running: no banner, and its routines neither move in nor out', () => {
    const s = S({ active: run(['push']) })
    expect(missedDay(s, TODAY)).toBeNull()
    expect(movePlan(s, FRI, TODAY)).toEqual({ iso: FRI, id: 'legs', displaced: null })
    expect(movePlan(S({ active: run(['legs']) }), FRI, TODAY)).toBeNull()
  })

  it('an open editor on a saved workout is not a workout running: the banner stays', () => {
    expect(missedDay(S({ active: run(['pull'], { editingWorkoutId: 'w1' }) }), TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
  })
})

describe('a combined day moves one routine, the one every line names', () => {
  it('movingId: the first the landing day does not hold already, else the first', () => {
    expect(movingId(['push', 'legs'], ['push'])).toBe('legs')
    expect(movingId(['push', 'legs'], [])).toBe('push')
    expect(movingId(['push'], ['push'])).toBe('push')
  })

  it('missed Push A + Legs with Push A planned today: Move brings Legs, not a no-op Push A', () => {
    const s = S({ week: { 0: ['push'], 5: ['push', 'legs'] } })
    expect(missedDay(s, TODAY)).toEqual({ iso: FRI, ids: ['push', 'legs'] })
    expect(movePlan(s, FRI, TODAY)).toEqual({ iso: FRI, id: 'legs', displaced: { ids: ['push'], id: 'push', floats: false, to: MON } })
    const moved = moveToToday(s, FRI, TODAY, 1)
    expect(moved.id).toBe('legs')
    expect(s.dayPlan).toEqual({ [TODAY]: 'legs', [MON]: 'push' })
  })

  it('a combined missed day partly trained today: Move offers what is still owed', () => {
    const s = S({ week: { 5: ['push', 'legs'] }, workouts: [workout('w1', WED, ['pull']), workout('w2', TODAY, ['push'])] })
    expect(missedDay(s, TODAY)).toEqual({ iso: FRI, ids: ['legs'] })
    expect(movePlan(s, FRI, TODAY)).toEqual({ iso: FRI, id: 'legs', displaced: null })
  })

  it('Rest on a combined day writes the routine restPlan names to the free day', () => {
    const s = S({ week: { 0: ['legs', 'pull'] } })
    const plan = restPlan(s, TODAY, TODAY)
    expect(plan).toMatchObject({ ids: ['legs', 'pull'], id: 'legs', to: MON })
    restDay(s, TODAY, TODAY)
    expect(s.dayPlan).toEqual({ [TODAY]: 'rest', [MON]: plan.id })
  })
})

describe('Skip it', () => {
  it('marks the day seen and changes nothing else; it stays missed', () => {
    const s = S()
    const plan = clone(s.dayPlan)
    const skipped = skipMissed(s, FRI, 100)
    expect(skipped.iso).toBe(FRI)
    expect(s.dayPlan).toEqual(plan)
    expect(seenOn(s, FRI)).toBe(true)
    expect(missedDay(s, TODAY)).toBeNull()
    expect(effectiveRoutineIds(s, FRI, TODAY)).toEqual(['legs'])
  })

  it('Undo clears the seen state with a stamped entry, so the clear syncs', () => {
    const s = S()
    const skipped = skipMissed(s, FRI, 100)
    skipped.undo(s, 300)
    expect(s.missedSeen).toEqual({ [FRI]: { _ts: 300 } })
    expect(seenOn(s, FRI)).toBe(false)
  })

  it('works on a copy that has no missedSeen yet', () => {
    const s = S()
    delete s.missedSeen
    skipMissed(s, FRI, 7)
    expect(s.missedSeen).toEqual({ [FRI]: { seen: true, skipped: true, _ts: 7 } })
  })

  it('only Skip marks the day skipped: Move to today leaves it seen, not skipped', () => {
    const skipped = S()
    skipMissed(skipped, FRI, 7)
    expect(skippedOn(skipped, FRI)).toBe(true)
    const moved = S()
    moveToToday(moved, FRI, TODAY, 7)
    expect(seenOn(moved, FRI)).toBe(true)
    expect(skippedOn(moved, FRI)).toBe(false)
  })
})

describe('Rest / skip this day', () => {
  it('says first what it would do: the day rests, its session goes to the next free day after it', () => {
    expect(restPlan(S(), TODAY, TODAY)).toEqual({ iso: TODAY, ids: ['push'], id: 'push', floats: false, to: TUE })
    // From Monday the search starts after Monday, not after today.
    expect(restPlan(S(), MON, TODAY)).toEqual({ iso: MON, ids: ['legs'], id: 'legs', floats: false, to: TUE })
    expect(nextFreeDay(S(), TODAY, '2026-10-21')).toBe('2026-10-22')
  })

  it('is null on a day with nothing planned, and writes nothing', () => {
    const s = S()
    expect(restPlan(s, TUE, TODAY)).toBeNull()
    expect(restDay(s, TUE, TODAY)).toBeNull()
    expect(s.dayPlan).toEqual({})
  })

  it('rests the day, puts the session on the free day, and Undo puts both back as they were', () => {
    const s = S({ dayPlan: { [TODAY]: 'pull' } })
    const rested = restDay(s, TODAY, TODAY)
    expect(rested.to).toBe(TUE)
    expect(s.dayPlan).toEqual({ [TODAY]: 'rest', [TUE]: 'pull' })
    expect(effectiveRoutineIds(s, TODAY, TODAY)).toEqual([])
    expect(effectiveRoutineIds(s, TUE, TODAY)).toEqual(['pull'])
    rested.undo(s)
    expect(s.dayPlan).toEqual({ [TODAY]: 'pull' })
  })

  it('a combined day moves its first routine; the day only rests when no day ahead is free', () => {
    const s = S({ week: { 0: ['push', 'pull'], 1: ['legs'], 2: ['legs'], 3: ['legs'], 4: ['legs'], 5: ['legs'], 6: ['legs'] } })
    const rested = restDay(s, TODAY, TODAY)
    expect(rested).toMatchObject({ ids: ['push', 'pull'], id: 'push', to: null })
    expect(s.dayPlan).toEqual({ [TODAY]: 'rest' })
    rested.undo(s)
    expect(s.dayPlan).toEqual({})
    const free = S({ week: { 0: ['push', 'pull'] } })
    restDay(free, TODAY, TODAY)
    expect(free.dayPlan).toEqual({ [TODAY]: 'rest', [MON]: 'push' })
  })

  it('a queue session is not written anywhere: the queue floats it to the next day you train', () => {
    const since = new Date('2026-10-15T00:00:00').getTime()
    const s = S({ week: { 5: ['legs'] }, queue: { ids: ['push', 'pull'], since, startsOn: THU, rotationId: 'rot' }, rotation: { id: 'rot', sequence: ['push', 'pull'] } })
    const rested = restDay(s, TODAY, TODAY)
    expect(rested).toMatchObject({ ids: ['push'], floats: true, to: null })
    expect(s.dayPlan).toEqual({ [TODAY]: 'rest' })
    expect(effectiveRoutineIds(s, MON, MON)).toEqual(['push'])
  })
})
