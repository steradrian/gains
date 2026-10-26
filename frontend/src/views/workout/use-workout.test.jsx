// @vitest-environment happy-dom
// useWorkout (core-M1), the running workout's one hook, against the real store and the real timers.
// First its own contract: the takeover and S.autoNext, a new best at most once per exercise per session, the openers it calls through
// drawers.js, the high-water marks. Then the cases ported from views/Workout.test.jsx (guard-M1):
// the completion flow, the hold a rest displaced, the live-presence heartbeat and its "left" signal.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api, beacon } from '../../lib/api.js'
import { workoutCompleteSheet } from '../../sheets.jsx'
import { addExerciseSheet, exerciseRestSheet } from './drawers.js'
import { exerciseSettingsSheet } from './exercise-drawers.jsx'
import { makeSideSet } from '../../lib/workout-model.js'
import { resetBested, useWorkout } from './use-workout.js'
import { copyActiveSet, deleteActiveSet, moveEntryWithinPart } from './workout-actions.js'
import { PAST_BENCH, active, exercise, lift, mountHook, resetTimers, seed, stretch, timed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/', IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../../sheets.jsx', async importOriginal => ({ ...(await importOriginal()), workoutCompleteSheet: vi.fn(), swapActiveWorkoutExercise: vi.fn() }))
vi.mock('./drawers.js', async importOriginal => ({ ...(await importOriginal()), addExerciseSheet: vi.fn(), exerciseRestSheet: vi.fn() }))
vi.mock('./exercise-drawers.jsx', async importOriginal => ({ ...(await importOriginal()), exerciseSettingsSheet: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const realStartRest = useUI.getState().startRest
let startRest
let hook

function start(entries, opts = {}) {
  seed(entries, opts)
  hook = mountHook(useWorkout)
  return hook
}
const actions = () => hook.out.current.actions
const view = () => hook.out.current.view
const tick = (idx, i, side) => act(() => actions().toggle(idx, i, side))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  resetBested()
  startRest = vi.fn(realStartRest)
  useUI.setState({ startRest })
})
afterEach(() => {
  hook?.unmount()
  hook = null
  resetTimers()
  useUI.setState({ startRest: realStartRest })
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the hook: takeover and autoNext', () => {
  it('hands over to the next exercise after the last set and raises a takeover whose Back returns', () => {
    start([lift('0025', 80, 8, 1), lift('0426', 24, 8, 1)])
    tick(0, 0)
    expect(active().cur).toBe(1)
    expect(view().takeover).toMatchObject({ kind: 'exercise', backTo: 0 })
    act(() => actions().backTo(0))
    expect(active().cur).toBe(0)
    expect(view().takeover).toBeNull()
  })

  it('with autoNext off the hero stays on the finished exercise, and the takeover is not raised', () => {
    start([lift('0025', 80, 8, 1), lift('0426', 24, 8, 1)], { autoNext: false })
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(view().takeover).toBeNull()
  })

  it('the warm-up done event is raised with autoNext off too', () => {
    const warm = { ...lift('0001', 0, 15, 1), part: 'warmup' }
    start([warm, lift('0025', 80, 8, 1)], { autoNext: false })
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(view().takeover).toMatchObject({ kind: 'part', backTo: null })
    expect(view().takeover.text).toContain('Warm-up done')
  })

  it('a takeover is taken once and stays gone', () => {
    start([lift('0025', 80, 8, 1), lift('0426', 24, 8, 1)])
    tick(0, 0)
    act(() => actions().takeEvent('takeover'))
    expect(view().takeover).toBeNull()
  })
})

describe('a new best', () => {
  const bench = (...weights) => ({ ...lift('0025', 80, 8, weights.length), sets: weights.map(w => ({ w, r: 8, done: false })) })

  it('is raised for a set that beats every past session, once per exercise per session', () => {
    start([bench(85, 90), lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH] })
    tick(0, 0)
    expect(view().newBest).toMatchObject({ exId: '0025', idx: 0 })
    expect(view().newBest.text).toContain('85')
    act(() => actions().takeEvent('newBest'))
    tick(0, 1)
    expect(view().newBest).toBeNull()
  })

  it('is not raised for a set that only matches the best', () => {
    start([bench(80, 80), lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH] })
    tick(0, 0)
    expect(view().newBest).toBeNull()
  })

  it('is raised for each exercise on its own', () => {
    const press = { ...lift('0426', 24, 8, 1), sets: [{ w: 30, r: 8, done: false }] }
    const past = { ...PAST_BENCH, entries: [...PAST_BENCH.entries, { id: '0426', target: { mode: 'reps', sets: 1, reps: 8, weight: 24 }, sets: [{ w: 24, r: 8, done: true }] }] }
    start([bench(85), press], { workouts: [past] })
    tick(0, 0)
    expect(view().newBest.exId).toBe('0025')
    act(() => actions().takeEvent('newBest'))
    tick(1, 0)
    expect(view().newBest.exId).toBe('0426')
  })

  it('is not raised for a warm-up row, a saved workout being edited or a workout logged into the past', () => {
    const warmupRow = { ...bench(90), sets: [{ w: 90, r: 8, done: false, phase: 'warmup' }] }
    start([warmupRow], { workouts: [PAST_BENCH] })
    tick(0, 0)
    expect(view().newBest).toBeNull()
    hook.unmount()
    start([bench(90), lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH], active: { editingWorkoutId: 'past' } })
    tick(0, 0)
    expect(view().newBest).toBeNull()
    hook.unmount()
    start([bench(90), lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH], active: { backfill: { durationMin: 60, replaceId: null } } })
    tick(0, 0)
    expect(view().newBest).toBeNull()
  })

  it('is raised for a per-side set once both sides are ticked', () => {
    const split = { ...bench(85), target: { mode: 'reps', sets: 1, reps: 8, weight: 85, side: true }, sets: [makeSideSet({ w: 85, r: 16 })] }
    start([split, lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH] })
    tick(0, 0, 'L')
    tick(0, 0, 'R')
    expect(view().newBest).toMatchObject({ exId: '0025', idx: 0 })
  })

  it('is not raised twice when the screen is left and come back to', () => {
    start([bench(85, 90), lift('0426', 24, 8, 1)], { workouts: [PAST_BENCH] })
    tick(0, 0)
    expect(view().newBest).not.toBeNull()
    hook.unmount()
    hook = mountHook(useWorkout)
    tick(0, 1)
    expect(view().newBest).toBeNull()
  })
})

describe('the openers go through drawers.js', () => {
  it('Add exercise opens addExerciseSheet after the given exercise, into the given part', () => {
    start([lift('0025', 80, 8, 1)])
    act(() => actions().addExercise({ afterIdx: 0, part: 'cooldown' }))
    expect(addExerciseSheet).toHaveBeenCalledWith(0, 'cooldown')
    act(() => actions().addExercise())
    expect(addExerciseSheet).toHaveBeenLastCalledWith(null, null)
  })

  it('the exercise rest and the progression settings open their own drawers for that exercise', () => {
    start([lift('0025', 80, 8, 1), lift('0426', 24, 8, 1)])
    act(() => actions().openExerciseRest(1))
    expect(exerciseRestSheet).toHaveBeenCalledWith(1)
    act(() => actions().openProgressionSettings(1))
    expect(exerciseSettingsSheet).toHaveBeenCalledWith(1)
  })
})

describe('the progress high-water mark', () => {
  it('re-ticking a finished exercise does not hand over again, and a removed set takes its tick with it', () => {
    start([lift('0025', 80, 8, 1), lift('0426', 24, 8, 2)])
    tick(0, 0)
    expect(active().cur).toBe(1)
    act(() => actions().takeEvent('takeover'))
    act(() => actions().selectEntry(0))
    tick(0, 0)
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(view().takeover).toBeNull()
  })
})

describe('Workout set completion flow (ported from views/Workout.test.jsx:285)', () => {
  // autoNext off: the hero stays on the finished exercise unless the test moves it.
  const setup = (entries, opts = {}) => start(entries, { autoNext: false, ...opts })

  it('rests the exercise\'s warm-up rest between ramp sets, and its working rest after the last ramp set', () => {
    start([exercise('ramped-squat', [false, false, false, false], {
      target: { mode: 'reps', reps: 6, weight: 125, bodyweight: false, restSec: 150, warmupRestSec: 45 },
      sets: [
        { w: 60, r: 8, done: false, phase: 'warmup' },
        { w: 95, r: 5, done: false, phase: 'warmup' },
        { w: 125, r: 6, done: false, phase: 'work' },
        { w: 125, r: 6, done: false, phase: 'work' },
      ],
    })], { autoNext: false })
    tick(0, 0)
    expect(startRest).toHaveBeenLastCalledWith(45, expect.any(Number), { forSet: expect.any(Number) })
    tick(0, 1)
    expect(startRest).toHaveBeenLastCalledWith(150, expect.any(Number), { forSet: expect.any(Number) })
    tick(0, 2)
    expect(startRest).toHaveBeenLastCalledWith(150, expect.any(Number), { forSet: expect.any(Number) })
    expect(startRest).toHaveBeenCalledTimes(3)
  })

  it('starts rest after a non-final ordinary set, but stops rest without restarting it on the final set', () => {
    start([exercise('plain-bench', [false, false, false])], { autoNext: false })
    tick(0, 0)
    expect(startRest).toHaveBeenCalledTimes(1)
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
    expect(useUI.getState().timer).toMatchObject({ total: 90, forIdx: 0, forSet: 0 })

    hook.unmount()
    startRest.mockClear()
    start([exercise('plain-treadmill', [false], { target: { mode: 'cardio', min: 20, speed: 8 } })], { autoNext: false })
    realStartRest(60, 0)
    tick(0, 0)
    expect(useUI.getState().timer).toBeNull()
    expect(startRest).not.toHaveBeenCalled()
  })

  it('auto-captures a completed weighted exercise without prompting, leaving navigation to Next (autoNext off)', () => {
    setup([exercise('plain-bench', [false]), exercise('next', [false])])
    tick(0, 0)
    expect(active().entries[0].topW).toBe(60)
    expect(useStore.getState().S.exWeights['plain-bench']).toBeUndefined()   // written at the finish, not while ticking
    expect(active().cur).toBe(0)
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
    act(() => actions().navigateUnit(1))
    expect(active().cur).toBe(1)
  })

  it('auto-captures superset members without prompting, then leaves the completed unit for Next (autoNext off)', () => {
    setup([exercise('superset-a', [false], { sg: 'superset-1' }), exercise('superset-b', [false], { sg: 'superset-1' }), exercise('next', [false])])
    tick(0, 0)
    expect(active().cur).toBe(1)
    expect(startRest).not.toHaveBeenCalled()
    tick(1, 0)
    expect(active().cur).toBe(1)
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
    act(() => actions().navigateUnit(1))
    expect(active().cur).toBe(2)
  })

  const incompleteWarmup = phase => exercise('next', [false, false], {
    asked: true, sets: [{ w: 30, r: 5, done: false, phase }, { w: 60, r: 5, done: false }],
  })

  it.each(['warmup', 'warm-up', 'warm_up'])('starts no transition rest before an incomplete %s row in the next ordinary exercise', phase => {
    setup([exercise('current', [false], { asked: true }), incompleteWarmup(phase)])
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('the new screen takes over to that exercise, and still starts no transition rest before its warm-up row', () => {
    start([exercise('current', [false], { asked: true }), incompleteWarmup('warmup')])
    tick(0, 0)
    expect(active().cur).toBe(1)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('does not navigate or start transition rest when a completed superset meets an incomplete warm-up (autoNext off)', () => {
    setup([exercise('superset-a', [true], { sg: 'group', asked: true }), exercise('superset-b', [false], { sg: 'group', asked: true }), incompleteWarmup('warmup')], { cur: 1 })
    tick(1, 0)
    expect(active().cur).toBe(1)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('leaves the completed ordinary exercise selected without transition rest before an incomplete warm-up (autoNext off)', () => {
    setup([exercise('current-loaded', [false]), incompleteWarmup('warmup')])
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('does not restart transition rest when re-checking a completed unit before an incomplete warm-up (autoNext off)', () => {
    setup([exercise('current', [true], { asked: true }), incompleteWarmup('warmup')])
    tick(0, 0)
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(startRest).not.toHaveBeenCalled()
  })

  // A rest that ran out stays on screen as Ready (#204) until it is dismissed. It is not a rest
  // counting down, so re-checking a finished set still owes the rest it always did (issue #3).
  it('starts the rest a re-check owes while the last one only shows Ready', () => {
    setup([exercise('current', [true, false, false])])
    useUI.setState({ timer: { left: 0, total: 90, endsAt: Date.now() - 1000, forIdx: 0, ready: true } })
    tick(0, 0)
    tick(0, 0)
    expect(startRest).toHaveBeenCalledWith(90, 0, { forSet: expect.any(Number) })
  })

  it('leaves a rest that is still counting down alone on a re-check', () => {
    setup([exercise('current', [true, false, false])])
    useUI.setState({ timer: { left: 40, total: 90, endsAt: Date.now() + 40000, forIdx: 0 } })
    tick(0, 0)
    tick(0, 0)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('leaves a completed superset selected without opening a top-weight sheet (autoNext off)', () => {
    setup([
      exercise('superset-a', [true, true, true], { sg: 'superset-1', asked: true }),
      exercise('superset-b', [true, true, false], { sg: 'superset-1' }),
      exercise('next-exercise', [false, false, false]),
    ], { cur: 1 })
    tick(1, 2)
    expect(active().cur).toBe(1)
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
  })

  it('does not auto-select an unfinished superset after completing an ordinary exercise (autoNext off)', () => {
    setup([
      exercise('current-hold', [false], { asked: true, target: { mode: 'time', sec: 30, weight: 0 } }),
      exercise('already-done', [true], { asked: true }),
      exercise('pending-a', [false], { sg: 'pending-group' }),
      exercise('pending-b', [false], { sg: 'pending-group' }),
    ])
    tick(0, 0)
    expect(active().cur).toBe(0)
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
    expect(useUI.getState().toastMsg).toBe('Hold logged')
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
  })

  it('does not auto-select earlier unfinished work after completing an ordinary exercise (autoNext off)', () => {
    setup([
      exercise('pending-earlier', [false], { asked: true }),
      exercise('current-hold', [false], { asked: true, target: { mode: 'time', sec: 30, weight: 0 } }),
    ], { cur: 1 })
    tick(1, 0)
    expect(active().cur).toBe(1)
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
  })

  it('leaves a completed ordinary exercise selected without declaring completion while work remains (autoNext off)', () => {
    setup([exercise('current-loaded', [false]), exercise('pending', [false], { asked: true })])
    tick(0, 0)
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
    expect(view().allDone).toBeNull()
    expect(active().cur).toBe(0)
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
  })

  it('shows workout completion only when no unfinished unit remains: the screen shows W1.9 itself', () => {
    start([exercise('already-done', [true], { asked: true }), exercise('final-hold', [false], { asked: true, target: { mode: 'time', sec: 30, weight: 0 } })], { cur: 1 })
    expect(view().allDone).toBeNull()
    tick(1, 0)
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
    expect(view().allDone).not.toBeNull()
    expect(active().cur).toBe(1)
    expect(startRest).not.toHaveBeenCalled()
  })

  it('edits a saved set without live completion, rest or success feedback', () => {
    start([exercise('plain-bench', [false])], { active: { editingWorkoutId: 'saved' } })
    tick(0, 0)
    expect(active().entries[0].sets[0].done).toBe(true)
    expect(startRest).not.toHaveBeenCalled()
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
    expect(useUI.getState().toastMsg).toBeFalsy()
    expect(active().entries[0].sets[0].at).toBeUndefined()
  })
})

// A rest that starts while a hold is running takes the hold down (useUI: the two must never run
// together), so the hold hands back what it held on the way out and its own row keeps it. It is
// explicitly not a finish: the row stays unticked and starts no rest of its own, because the rest
// that displaced it is the one counting down. And `sec` on a timed row is both the plan and the
// log, so a part-held set must not become the next hold's target.
describe('a hold a rest displaced (ported from views/Workout.test.jsx:727)', () => {
  const hold = (sec = 30) => start([timed('timed-plank', sec)], { autoNext: false })
  const startHold = () => act(() => actions().startTimed(0, 0))
  const held = sec => act(() => { vi.advanceTimersByTime(sec * 1000) })
  // The displacing rest is another exercise's, started directly: useUI.startRest abandons the hold.
  const displace = () => act(() => realStartRest(90, 0))
  const set0 = () => active().entries[0].sets[0]

  it('keeps its seconds, stays unticked and starts no rest of its own', () => {
    hold()
    startHold()
    held(18)
    startRest.mockClear()
    displace()
    expect(set0()).toMatchObject({ sec: 18, done: false })
    expect(startRest).not.toHaveBeenCalled()
  })

  it('shows what it held without becoming the next hold\'s target', () => {
    hold(30)
    startHold()
    expect(useUI.getState().work.total).toBe(30)
    held(3)
    displace()
    expect(set0()).toMatchObject({ sec: 3, planSec: 30, done: false })
    startHold()
    expect(useUI.getState().work.total).toBe(30)            // the plan, not the 3 s it managed
  })

  it('a plan you edited yourself survives the same way', () => {
    hold(55)
    startHold()
    expect(useUI.getState().work.total).toBe(55)
    held(4)
    displace()
    startHold()
    expect(useUI.getState().work.total).toBe(55)
  })

  it('and typing a duration is the new plan, so the plan it kept aside goes', () => {
    hold(30)
    startHold()
    held(3)
    displace()
    expect(set0().planSec).toBe(30)
    act(() => actions().setField(0, 0, 'sec', 35))
    expect(set0().planSec).toBeUndefined()
    startHold()
    expect(useUI.getState().work.total).toBe(35)            // what the field says, not the old plan
  })

  it('and once the row is ticked, the plan it kept aside goes', () => {
    hold(30)
    startHold()
    held(3)
    displace()
    expect(set0().planSec).toBe(30)
    tick(0, 0)                                               // ticked by hand
    expect(set0().planSec).toBeUndefined()
    expect(set0().done).toBe(true)
  })

  // Ticking the held row's own check is the same mechanism from the other side: the tick starts the
  // rest, the rest displaces the hold, and the hand-back lands on the row the tick just ticked. So
  // the row logs what was actually held rather than its target, and keeps no plan.
  it('ticking the held row by hand logs what was held, not the target', () => {
    hold(30)
    startHold()
    held(18)
    tick(0, 0)
    expect(set0()).toMatchObject({ sec: 18, done: true })
    expect(set0().planSec).toBeUndefined()
  })

  it('a hold held to the end still logs and ticks, and keeps no plan behind', () => {
    hold(30)
    startHold()
    held(31)
    expect(set0()).toMatchObject({ sec: 30, done: true })
    expect(set0().planSec).toBeUndefined()
  })

  it('the new screen\'s hold ticks through the same path', () => {
    start([timed('timed-plank', 30, 1), lift('0025', 80, 8, 1)])
    startHold()
    held(31)
    expect(set0()).toMatchObject({ sec: 30, done: true })
    expect(active().cur).toBe(1)
  })

  it('a hold restored after a reload gets its handler back from the hook', () => {
    seed([timed('timed-plank', 30, 2)])
    useUI.setState({ work: { left: 20, total: 30, endsAt: Date.now() + 20000, label: 'Plank', owner: { idx: 0, i: 0, id: 'timed-plank' } } })
    hook = mountHook(useWorkout)
    act(() => useUI.getState().finishWorkEarly())
    expect(set0().done).toBe(true)
    expect(set0().sec).toBeGreaterThan(0)
  })
})

// The live-presence "left" signal goes through lib/api.js beacon() (the web app's own origin,
// nothing on a phone, where the api() call beside it reaches the server).
describe('live-presence heartbeat (ported from views/Workout.test.jsx:868)', () => {
  const USER = { id: 'u1', name: 'Boris' }
  let visibility
  const heartbeats = () => vi.mocked(api).mock.calls.filter(([path, opts]) => path === '/api/activity' && JSON.parse(opts.body).active === true).length
  const reasons = () => vi.mocked(beacon).mock.calls.map(([, body]) => body.reason)
  const setVisibility = state => { visibility = state; act(() => { document.dispatchEvent(new Event('visibilitychange')) }) }
  const pagehide = () => act(() => { window.dispatchEvent(new Event('pagehide')) })
  const pageshow = persisted => act(() => { window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted })) })
  const signedIn = () => {
    start([exercise('plain-bench', [false])], { user: USER })
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  }

  it('leaving the screen signed in sends the "left" signal through beacon() and the API, as navigated', () => {
    start([exercise('plain-bench', [false])], { user: USER })
    expect(api).toHaveBeenCalledWith('/api/activity', expect.objectContaining({ method: 'POST' }))
    hook.unmount()
    hook = null
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith('/api/activity', { active: false, reason: 'navigated' })
    expect(api).toHaveBeenLastCalledWith('/api/activity', { method: 'POST', body: JSON.stringify({ active: false, reason: 'navigated' }) })
  })

  it('a guest has no server session, so there is no heartbeat and no signal', () => {
    start([exercise('plain-bench', [false])])
    hook.unmount()
    hook = null
    expect(beacon).not.toHaveBeenCalled()
    expect(api).not.toHaveBeenCalledWith('/api/activity', expect.anything())
  })

  it('the heartbeat reports the exercise and the sets, and a saved workout being edited sends none', () => {
    start([exercise('plain-bench', [true, false]), exercise('next', [false])], { user: USER })
    const body = JSON.parse(vi.mocked(api).mock.calls.find(([p]) => p === '/api/activity')[1].body)
    expect(body).toMatchObject({ active: true, name: 'Test workout', exIdx: 1, exTotal: 2, setsDone: 1, setsTotal: 3 })
    hook.unmount()
    vi.clearAllMocks()
    start([exercise('plain-bench', [false])], { user: USER, active: { editingWorkoutId: 'saved' } })
    expect(api).not.toHaveBeenCalledWith('/api/activity', expect.anything())
  })

  it('a closing tab (pagehide) sends it through beacon() as closed while the screen is still mounted', () => {
    signedIn()
    pagehide()
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith('/api/activity', { active: false, reason: 'closed' })
  })

  it('an iOS home-screen app going hidden sends it as hidden, once, however many hidden events follow', () => {
    signedIn()
    setVisibility('hidden')
    setVisibility('hidden')
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith('/api/activity', { active: false, reason: 'hidden' })
  })

  it('a close whose pagehide follows the hidden visibilitychange still sends closed, once', () => {
    signedIn()
    setVisibility('hidden')
    pagehide()
    pagehide()
    expect(reasons()).toEqual(['hidden', 'closed'])
  })

  it('nothing follows closed: a visibilitychange to hidden after the pagehide sends nothing more', () => {
    signedIn()
    pagehide()
    setVisibility('hidden')
    expect(reasons()).toEqual(['closed'])
  })

  it('shown again, the page heartbeats at once, and the next hide sends it again', () => {
    signedIn()
    const before = heartbeats()
    setVisibility('hidden')
    setVisibility('visible')
    expect(heartbeats()).toBe(before + 1)
    setVisibility('hidden')
    expect(reasons()).toEqual(['hidden', 'hidden'])
  })

  it('a page back from the back/forward cache heartbeats at once, and its next close sends closed again', () => {
    signedIn()
    const before = heartbeats()
    pagehide()
    pageshow(false)
    expect(heartbeats()).toBe(before)
    pageshow(true)
    expect(heartbeats()).toBe(before + 1)
    pagehide()
    expect(reasons()).toEqual(['closed', 'closed'])
  })

  it('a hidden page that keeps heartbeating is re-armed, for hidden and for the close that follows', () => {
    signedIn()
    setVisibility('hidden')
    expect(reasons()).toEqual(['hidden'])
    const before = heartbeats()
    act(() => { vi.advanceTimersByTime(20000) })
    expect(heartbeats()).toBe(before + 1)
    setVisibility('hidden')
    expect(reasons()).toEqual(['hidden', 'hidden'])
    pagehide()
    expect(reasons()).toEqual(['hidden', 'hidden', 'closed'])
  })

  it('a guest sends nothing, and an unmounted screen stops listening', () => {
    start([exercise('plain-bench', [false])])
    pagehide()
    expect(beacon).not.toHaveBeenCalled()
    hook.unmount()

    signedIn()
    hook.unmount()
    hook = null
    expect(reasons()).toEqual(['navigated'])                 // the cleanup's own
    const after = heartbeats()
    window.dispatchEvent(new Event('pagehide'))
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(heartbeats()).toBe(after)
  })
})

// stretch() is the cool-down fixture the screen tests use; the hook's cool-down offer reads it.
describe('the cool-down offer', () => {
  it('is raised once, when the last working set is done and a cool-down is left', () => {
    start([lift('0025', 80, 8, 1), stretch()])
    expect(view().offer).toBeNull()
    tick(0, 0)
    expect(view().offer).toBe('cooldown')
  })

  it('is not raised again once it has been offered, nor after the cool-down was skipped', () => {
    start([lift('0025', 80, 8, 1), stretch()], { active: { offered: { cooldown: true } } })
    tick(0, 0)
    expect(view().offer).toBeNull()
    hook.unmount()
    start([lift('0025', 80, 8, 1), stretch()], { active: { skipped: { cooldown: true } } })
    tick(0, 0)
    expect(view().offer).toBeNull()
  })
})

// guard-M2d: what the hook keeps by index follows a reorder from the map.
describe('the hook after a reorder (ported from views/Workout.test.jsx:2834 and Workout.swipe.test.jsx:173)', () => {
  const sets = (id, dones, extra = {}) => ({ ...exercise(id, dones), ...extra })

  it('a member swap keeps each exercise\'s counted sets with it, so its next tick still counts', () => {
    // pull-up has two sets counted, leg-raise none. After the swap the leg raise's first tick is
    // new work and moves on through the superset; read against the pull-up's two it would be a
    // re-check and go nowhere.
    start([
      sets('bench', [true]),
      sets('pull-up', [true, true, false], { sg: 'm' }),
      sets('leg-raise', [false, false, false], { sg: 'm' }),
      sets('plank', [false, false, false], { sg: 'm' }),
    ], { cur: 1 })
    act(() => { moveEntryWithinPart(1, 2) })
    expect(active().entries.map(e => e.id)).toEqual(['bench', 'leg-raise', 'pull-up', 'plank'])
    expect(active().cur).toBe(1)
    tick(1, 0)
    expect(active().entries[1].sets.filter(s => s.done)).toHaveLength(1)
    expect(active().cur).toBe(2)
  })

  it('a hold writes what it held to its own row after a set above it was copied or removed', () => {
    start([timed('timed-plank', 50, 3)], { autoNext: false })
    act(() => actions().startTimed(0, 2))
    expect(useUI.getState().work).not.toBeNull()
    act(() => { copyActiveSet(0, 0) })
    act(() => { deleteActiveSet(0, 1) })
    act(() => useUI.getState().finishWorkEarly())
    const rows = active().entries[0].sets
    expect(rows).toHaveLength(3)
    expect(rows[2].done).toBe(true)
    expect(rows[2].sec).toBeLessThanOrEqual(50)
    expect(rows[0].done).toBe(false)
    expect(rows[1].done).toBe(false)
  })

  it('a hold writes to its own exercise after the exercises were reordered', () => {
    start([timed('timed-plank', 30, 1), lift('0025', 80, 8, 1)], { autoNext: false })
    act(() => actions().startTimed(0, 0))
    act(() => { moveEntryWithinPart(0, 1) })
    expect(active().entries[1].id).toBe('timed-plank')
    act(() => useUI.getState().finishWorkEarly())
    expect(active().entries[1].sets[0].done).toBe(true)
    expect(active().entries[0].sets[0].done).toBe(false)
  })
})

describe('adding a set to a sport', () => {
  const football = sets => ({ id: '12107', target: { mode: 'cardio', sets: 1, min: 60, eff: 2 }, sets })

  it('an effort sport copies the last set\'s effort and never gets a speed', () => {
    start([football([{ min: 45, eff: 3, done: true }])])
    act(() => actions().addSet(0))
    const added = active().entries[0].sets[1]
    expect(added).toMatchObject({ min: 45, eff: 3, done: false })
    expect(added).not.toHaveProperty('speed')
  })

  it('with no set left it opens at the planned minutes and effort', () => {
    start([football([])])
    act(() => actions().addSet(0))
    const added = active().entries[0].sets[0]
    expect(added).toMatchObject({ min: 60, eff: 2 })
    expect(added).not.toHaveProperty('speed')
  })
})
