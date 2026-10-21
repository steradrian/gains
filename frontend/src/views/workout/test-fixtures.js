// Shared fixtures for the running workout's tests (guard-M1). The old Workout.test.jsx mocked the
// store and the sheets and drove the old DOM; these seed the real store and the real timers, so the
// ported cases run through `useWorkout()` and `WorkoutScreen` the way users now do. The old test
// files keep their own copies until guard-M2 deletes them.
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

export const clone = value => JSON.parse(JSON.stringify(value))

/** The old file's `exercise(id, sets, extra)`: `sets` is a list of done flags, 60 kg x 5. */
export function exercise(id, sets, extra = {}) {
  return {
    id,
    target: { mode: 'reps', reps: 5, weight: 60, bodyweight: false },
    sets: sets.map(done => ({ w: 60, r: 5, done })),
    ...extra,
  }
}

/** A weighted exercise with `n` open sets planned at `w` x `r`. */
export const lift = (id, w, r, n, extra = {}) => ({
  id,
  target: { mode: 'reps', sets: n, reps: r, weight: w, restSec: 90 },
  sets: Array.from({ length: n }, () => ({ w, r, done: false })),
  ...extra,
})

/** A timed hold of `sec` seconds, `n` sets, body weight. */
export const timed = (id = 'timed-plank', sec = 30, n = 2, extra = {}) => ({
  id,
  target: { mode: 'time', sec, weight: 0, bodyweight: true },
  sets: Array.from({ length: n }, () => ({ sec, w: 0, done: false })),
  ...extra,
})

/** A cool-down stretch held on each side. */
export const stretch = () => ({
  id: '1053',
  part: 'cooldown',
  target: { mode: 'time', sec: 30, sets: 1, side: true },
  sets: [{ sec: 30, w: 0, side: 'L', done: false }, { sec: 30, w: 0, side: 'R', done: false }],
})

/** A saved session of 2 x 80 kg x 8 bench press, the history a NEW BEST is measured against. */
export const PAST_BENCH = {
  id: 'past', d: '2026-10-01', start: Date.parse('2026-10-01T18:00:00'), end: Date.parse('2026-10-01T19:00:00'), name: 'Push A', routineIds: [],
  entries: [{ id: '0025', target: { mode: 'reps', sets: 2, reps: 8, weight: 80, restSec: 90 }, sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }] }],
}

/**
 * Puts a running session into the real store: `S.active` over a copy of DEF. `active` overrides the
 * session's own fields, `user` is the signed-in user (null: a guest), everything else is settings.
 */
export function seed(entries, { cur = 0, active = {}, user = null, ...state } = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', restSec: 90, sound: false, effort: 'none', workouts: [], exWeights: {}, routines: [], ...state })
  S.active = { id: 'test-' + Math.random().toString(36).slice(2), d: '2026-10-21', start: Date.now() - 60000, name: 'Test workout', bw: null, cur, entries, ...active }
  useStore.setState({ S, user })
  return S
}

export const active = () => useStore.getState().S.active

/** Stops anything a test left running. Call it from afterEach. */
export function resetTimers() {
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.getState().closeAll()
  useUI.setState({ toastMsg: '', toastAction: null })
}

/** Renders a hook inside a probe component; `out.current` is its latest return value. */
export function mountHook(useHook, ...args) {
  const out = { current: null }
  const Probe = () => { out.current = useHook(...args); return null }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(createElement(Probe)))
  return {
    out,
    rerender: () => act(() => root.render(createElement(Probe))),
    unmount: () => { act(() => root.unmount()); host.remove() },
  }
}
