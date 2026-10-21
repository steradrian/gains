// @vitest-environment happy-dom
// Ready's model (use-ready.js, board W1.1): the session Start workout would build, grouped by part,
// each row's kind and plan, the title and the sub (exercises, the usual minutes, the muscles).
import { describe, expect, it, vi } from 'vitest'
import { DEF } from '../../store/useStore.js'
import { exOr } from '../../lib/exercises.js'
import { exerciseNameText } from '../../lib/format.js'
import { buildCombinedEntries } from '../../lib/session-merge.js'
import { normaliseParts } from '../../lib/workout-parts.js'
import { planLine, readyOf, startIdsOf, topMuscles, usualMinutes } from './use-ready.js'

vi.mock('../../sheets.jsx', () => ({
  confirmSheet: vi.fn(), menuSheet: vi.fn(), dayOverrideSheet: vi.fn(), planToolsSheet: vi.fn(), starterPlanSheet: vi.fn(),
  workoutDetailSheet: vi.fn(), dayNoteSheet: vi.fn(), dayOptionsSheet: vi.fn(), startChooserSheet: vi.fn(), startFlow: vi.fn(),
  logPastWorkoutSheet: vi.fn(), importPlanFile: vi.fn(),
}))

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025', FLY = '0227', LATERAL = '0334', SITUP = '0001', SQUAT = '0043'
const pushA = {
  id: 'push', name: 'Push A', ex: [
    { id: SITUP, sets: 2, reps: 15, part: 'warmup' },
    { id: BENCH, sets: 3, reps: 8, weight: 80 },
    { id: FLY, sets: 3, reps: 12, weight: 17.5 },
    { id: LATERAL, sets: 3, reps: 15, weight: 8 },
    { id: SQUAT, mode: 'time', sets: 2, sec: 30, side: true, part: 'cooldown' },
  ],
}
const state = (over = {}) => ({ ...clone(DEF), routines: [clone(pushA)], workouts: [], ...over })
const minutes = n => n * 60000
const done = (id, d, mins, routineIds = ['push']) => ({ id, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T10:00:00') + minutes(mins), routineIds, name: 'Push A', entries: [] })

describe('startIdsOf', () => {
  it('reads ?start=a,b without blanks or repeats', () => {
    expect(startIdsOf('?start=push,,pull,push')).toEqual(['push', 'pull'])
    expect(startIdsOf(new URLSearchParams('start=legs'))).toEqual(['legs'])
    expect(startIdsOf('')).toEqual([])
  })
})

describe('readyOf', () => {
  it('is the session beginWorkout would build, grouped Warm-up · Workout · Cool-down', () => {
    const S = state()
    const ready = readyOf(S, ['push'])
    const built = normaliseParts(buildCombinedEntries(S, ['push']).entries)
    expect(ready.groups.flatMap(g => g.rows.map(r => r.id))).toEqual(built.map(e => e.id))
    expect(ready.groups.map(g => g.label)).toEqual(['Warm-up · 1', 'Workout · 3', 'Cool-down · 1'])
    expect(ready.groups.map(g => g.part)).toEqual(['warmup', 'main', 'cooldown'])
    expect(ready).toMatchObject({ ids: ['push'], title: 'Push A', count: 5, hasWarmup: true, hasCooldown: true })
    expect(ready.groups[1].rows[0]).toMatchObject({ id: BENCH, name: exerciseNameText(exOr(BENCH)), line: 'Barbell · 3 × 8' })
  })

  it('a routine without parts is one Workout group and no offers', () => {
    const S = state({ routines: [{ id: 'r', name: 'Legs', ex: [{ id: SQUAT, sets: 5, reps: 5, weight: 100 }] }] })
    const ready = readyOf(S, ['r'])
    expect(ready.groups.map(g => g.label)).toEqual(['Workout · 1'])
    expect(ready).toMatchObject({ hasWarmup: false, hasCooldown: false })
  })

  it('unknown ids, freestyle and an empty routine have no Ready', () => {
    expect(readyOf(state(), ['gone'])).toBeNull()
    expect(readyOf(state(), [])).toBeNull()
    expect(readyOf(state({ routines: [{ id: 'e', name: 'Empty', ex: [] }] }), ['e'])).toBeNull()
  })

  it('combined routines take the derived name and keep warm-ups first', () => {
    const core = { id: 'core', name: 'Core', ex: [{ id: SITUP, sets: 2, reps: 10, part: 'warmup' }, { id: BENCH, sets: 1, reps: 5 }] }
    const ready = readyOf(state({ routines: [clone(pushA), core] }), ['push', 'core'])
    expect(ready.title).toBe('Push A + Core')
    expect(ready.groups.map(g => g.part)).toEqual(['warmup', 'main', 'cooldown'])
    expect(ready.groups[0].count).toBe(2)
  })

  it('the sub: exercises, the usual minutes, the three muscles worked most', () => {
    const S = state({ workouts: [done('a', '2026-10-01', 50), done('b', '2026-10-05', 60), done('c', '2026-10-08', 55), done('d', '2026-10-12', 40)] })
    const ready = readyOf(S, ['push'])
    // The last three: 60, 55 and 40 min; the median is 55.
    expect(ready.minutes).toBe(minutes(55))
    expect(ready.sub.split(' · ')).toEqual(['5 exercises', 'about 55 min', ready.muscles.join(', ')])
    expect(ready.muscles[0]).toBe('Chest')
    expect(ready.muscles).toHaveLength(2)
  })

  it('without a finished workout of these routines the minutes are left out', () => {
    const S = state({ workouts: [done('x', '2026-10-01', 50, ['other'])] })
    const ready = readyOf(S, ['push'])
    expect(ready.minutes).toBeNull()
    expect(ready.sub).not.toContain('about')
  })
})

describe('usualMinutes', () => {
  it('counts only workouts of exactly these routines, a minute or longer, median of the last 3', () => {
    const S = state({ workouts: [done('a', '2026-10-01', 30), done('b', '2026-10-02', 40, ['push', 'core']), done('c', '2026-10-03', 0.5), done('d', '2026-10-04', 50)] })
    expect(usualMinutes(S, ['push'])).toBe(minutes(40))
    expect(usualMinutes(S, ['core', 'push'])).toBe(minutes(40))
    expect(usualMinutes(S, ['legs'])).toBeNull()
  })
})

describe('planLine', () => {
  it('reads the kind and the plan', () => {
    expect(planLine({ id: BENCH, target: { id: BENCH, sets: 3, reps: 8 }, sets: [] })).toBe('Barbell · 3 × 8')
    expect(planLine({ id: SITUP, target: { id: SITUP, sets: 2, reps: 20, side: true }, sets: [] })).toBe('Body weight · 2 × 10 each side')
    expect(planLine({ id: SQUAT, target: { id: SQUAT, mode: 'time', sets: 2, sec: 30, side: true }, sets: [] })).toBe('Timed · 2 × 30 s each side')
    expect(planLine({ id: SQUAT, target: { id: SQUAT, mode: 'time', sets: 1, sec: 60 }, sets: [] })).toBe('Timed · 1 min')
  })
})

describe('topMuscles', () => {
  it('ranks primary muscles by planned sets, the workout part only', () => {
    const entries = [
      { id: SQUAT, part: 'warmup', target: { sets: 10 }, sets: [] },
      { id: BENCH, target: { sets: 3 }, sets: [] },
      { id: LATERAL, target: { sets: 4 }, sets: [] },
    ]
    expect(topMuscles(entries)).toEqual(['Shoulders', 'Chest'])
  })
})
