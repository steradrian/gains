// @vitest-environment happy-dom
// What the running workout shows about an exercise's past and plan (guard-M2a), through
// `useWorkout().view` against the real store: the "last 3 times" block that replaced the old
// reference line (views/Workout.test.jsx:3116), the phase progress that replaced the exercise
// chips (:2627), and the plan line (:2282), which has no home on the new screen yet.
//
// Dropped by design (owner question 1, the layouts and the reference toggle go): the list and
// compact views (:1990-2281), the view header menu's Layout sheet (:2334-2414), collapsing
// completed exercises (:2415-2518), "only what is left" (:2519-2626), chips riding in the pinned
// header (:2680), their motion and switch (:2696, :2706), the Last time / Best set toggle and its
// "3 days ago" wording (:3121, :3134, :3154, :3210).
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { resetBested, useWorkout } from './use-workout.js'
import { lift, mountHook, resetTimers, seed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/', IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const BENCH = '0025'
let hook
function start(entries, opts) {
  seed(entries, opts)
  hook = mountHook(useWorkout)
  return hook
}
const view = () => hook.out.current.view

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  resetBested()
})
afterEach(() => {
  hook?.unmount()
  hook = null
  resetTimers()
  useUI.getState().closeAll()
  vi.useRealTimers()
})

const session = (id, d, rid, w, r) => ({
  id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), name: 'Session', routineIds: [rid],
  entries: [{ id: BENCH, rid, target: { mode: 'reps', sets: 1, reps: r, weight: w }, sets: [{ w, r, done: true }] }],
})
const HISTORY = [session('a', '2026-08-10', 'B', 80, 5), session('b', '2026-08-24', 'A', 60, 10), session('c', '2026-08-26', 'A', 55, 8)]

// old :3121, :3147: the reference line, now the block under the fold
describe('the last 3 times block', () => {
  it('lists the last three sessions of the exercise and the best set of all of them', () => {
    start([lift(BENCH, 60, 8, 2, { rid: 'A' })], { workouts: [...HISTORY, session('d', '2026-08-28', 'A', 50, 8)] })
    const h = view().history
    expect(h.rows).toHaveLength(3)
    expect(h.first).toBeNull()
    // the heaviest set lies outside the last three, and still counts as the best
    expect(h.best).toContain('80')
    expect(h.bestSub).toMatch(/Est\. 1RM/)
  })

  it('says it is the first time, with no best, before the exercise was ever logged', () => {
    start([lift(BENCH, 60, 8, 2)])
    const h = view().history
    expect(h.title).toMatch(/first time$/)
    expect(h.rows).toEqual([])
    expect(h.best).toBeNull()
    expect(h.first).toContain('Nothing to compare with yet.')
    expect(h.first).not.toContain('Warm-ups never earn new bests.')
  })

  it('adds that a warm-up never earns a new best', () => {
    start([lift(BENCH, 40, 8, 2, { part: 'warmup' })])
    expect(view().history.first).toContain('Warm-ups never earn new bests.')
  })

  // old :3167 (#284): a workout logged into the past is held against what came before its day
  it('reads the history before the day of a workout logged into the past', () => {
    const later = [...HISTORY, session('e', '2026-08-28', 'A', 90, 3)]
    start([lift(BENCH, 60, 8, 2, { rid: 'A' })], { workouts: later, active: { d: '2026-08-25', backfill: { durationMin: 60, replaceId: null } } })
    const h = view().history
    expect(h.rows).toHaveLength(2)
    expect(h.best).toContain('80')
    expect(h.best).not.toContain('90')
  })

  // old :3116 (#216): "Last time" read this routine's own last session. exerciseHistory reads the
  // exercise across routines, so the block is not routine-scoped; the hero's "Last time" line is
  // the other half of the old line.
  it.todo('the hero\'s "Last time" reads this routine\'s own last session, not another routine\'s (old Workout.test.jsx:2316, :3121): decide whether the new screen scopes it')
  it.todo('every past set is its own left-to-right island, and a set with right-to-left words keeps its own direction (old Workout.test.jsx:3180, :3192): check the history rows in WorkoutBelow.jsx for `bdi`')
})

// old :2659: the chips followed the ticks, now the phase progress under the title
describe('the phase progress', () => {
  it('names the three phases and counts the exercises started and finished in the open one', () => {
    start([lift(BENCH, 60, 8, 2), lift('0426', 24, 8, 2)])
    expect(view().progress.phases.map(p => p.name)).toEqual(expect.arrayContaining(['Workout']))
    expect(view().progress.run).toMatchObject({ done: 0, partial: 0 })
    act(() => hook.out.current.actions.toggle(0, 0))
    expect(view().progress.run).toMatchObject({ done: 0, partial: 1 })
    act(() => hook.out.current.actions.toggle(0, 1))
    expect(view().progress.run.done).toBe(1)
  })

  // old :2715, :2720 (nothing to show; the dumbbell and "Freestyle workout"): WorkoutScreen.test.jsx 'shows Pick as you go for an empty freestyle session'
})

// old :2282-2333: "Plan: 2 × 10 · today 3 × 10". The new hero meta reads the entry's target only
// ("Barbell · 3 × 8 · 2:00 rest", heroMeta in workout-view.js), never `entry.planned`, so nothing on
// the new screen says that progression moved the sets or reps, or that the reps are carried over.
describe('the plan line', () => {
  it.todo('shows the plan when the rows are the plan: "Plan: 2 × 10" (old Workout.test.jsx:2290)')
  it.todo('says when progression moved the sets or reps: "Plan: 2 × 10 · today 3 × 10" (old :2295)')
  it.todo('says when the reps were carried over from the last session (old :2300)')
  it.todo('reads a double-progression aim inside the range as the plan: "Plan: 3 × 8–12" (old :2305)')
  it.todo('reads a pyramid as its targets, "12 · 8 · 6 · Max · 12" (old :2323)')
  it.todo('is not there for an entry with no plan (old :2328)')
})
