// @vitest-environment happy-dom
// The focus cases that still have a home on the new screen (guard-M1), ported from the
// "workout focus view" block of Workout.test.jsx (1556-1890) and FocusView.test.jsx (107-165): the
// first open set with its prescription, the done rows locked behind the steppers, a per-side
// set, a timed hold, cardio, speed in the profile's unit, a burst's rest-pause. The old screen's
// dots, Skip and set menu are the screen's ‹ › (WorkoutScreen.test.jsx), done rows and Set edit.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { addBurstAt } from './workout-actions.js'
import { resetBested, useWorkout } from './use-workout.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import { active, exercise, lift, mountHook, resetTimers, seed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const BENCH = '0025'
const SQUAT = '0043'
const ROW = '0334'
const BIKE = '2138'
let root
let host
function render(entries, opts) {
  seed(entries, opts)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
const unmount = () => { act(() => root?.unmount()); host?.remove(); root = null }
const labelled = label => host.querySelector(`button[aria-label="${label}"]`)
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const tap = el => { expect(el).toBeTruthy(); act(() => el.click()) }
const setOf = (idx = 0, i = 0) => active().entries[idx].sets[i]

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  unmount()
  resetTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the first open set', () => {
  it('shows only the first incomplete set with its prescription and tactile controls', () => {
    render([exercise(BENCH, [true, false, false], { target: { mode: 'reps', sets: 3, reps: 5, repsMin: 3, weight: 60, restSec: 120 } })], { effort: 'rpe' })
    expect(host.textContent).toContain('Set 2 of 3')
    expect(host.querySelectorAll('.g-cs')).toHaveLength(1)
    expect(labelled('More kg')).toBeTruthy()
    expect(labelled('More Reps')).toBeTruthy()
    expect(button('Done set')).toBeTruthy()
    expect(host.textContent).toContain('2:00 rest')
  })

  it('locks the sets already done: they are rows that open the set to fix, and the steppers belong to the next one', () => {
    render([exercise(BENCH, [false, false])], { autoNext: false })
    tap(button('Done set'))
    expect(host.querySelector('[aria-label="1, 60 kg × 5. Edit"]')).toBeTruthy()
    tap(labelled('More kg'))
    expect(setOf(0, 0).w).toBe(60)
    expect(setOf(0, 1).w).toBe(62.5)
  })
})

describe('a per-side set', () => {
  const split = () => exercise(SQUAT, [false], {
    target: { mode: 'reps', sets: 1, reps: 10, weight: 20, side: true },
    sets: [{ w: 20, r: 10, done: false, sides: { L: { w: 20, r: 5, done: false }, R: { w: 20, r: 5, done: false } } }],
  })

  it('updates one side at a time and completes the left side before the right', () => {
    render([split(), exercise(ROW, [false])])
    expect(host.textContent).toContain('Left')
    tap(labelled('More Reps'))
    expect(setOf().sides.L.r).toBe(6)
    expect(setOf().sides.R.r).toBe(5)
    tap(host.querySelector('.wk-done'))
    expect(setOf().sides.L.done).toBe(true)
    expect(setOf().done).toBe(false)
    expect(host.textContent).toContain('Right')
  })

  it('completes both sides before the hand-over to the next exercise', () => {
    render([split(), exercise(ROW, [false])])
    tap(host.querySelector('.wk-done'))
    tap(host.querySelector('.wk-done'))
    expect(setOf().sides.L.done).toBe(true)
    expect(setOf().sides.R.done).toBe(true)
    expect(setOf().done).toBe(true)
    expect(active().cur).toBe(1)
  })
})

describe('timed sets and cardio', () => {
  const plank = () => ({ id: '1053', target: { mode: 'time', sets: 1, sec: 45, weight: 0 }, sets: [{ sec: 45, w: 0, done: false }] })

  it('shows the timer action instead of reps for a timed set', () => {
    render([plank()])
    expect(button('Start · 0:45')).toBeTruthy()
    expect(labelled('More Reps')).toBeNull()
    expect(labelled('More Seconds')).toBeTruthy()
    tap(button('Start · 0:45'))
    expect(useUI.getState().work).not.toBeNull()
  })

  it('hands over to the next exercise when a timed set finishes through the shared timer', () => {
    render([plank(), exercise(ROW, [false])])
    tap(button('Start · 0:45'))
    act(() => { vi.advanceTimersByTime(46_000) })
    expect(setOf().done).toBe(true)
    expect(active().cur).toBe(1)
  })

  it('uses the duration and speed fields for cardio', () => {
    render([{ id: BIKE, target: { mode: 'cardio', sets: 1, min: 20, speed: 8 }, sets: [{ min: 20, speed: 8, done: false }] }])
    expect(labelled('More min')).toBeTruthy()
    expect(labelled('More km/h')).toBeTruthy()
    expect(labelled('More Reps')).toBeNull()
  })
})

// The speed stepper follows the profile's speed unit like the set row does (lib/speed.js): shown,
// stepped and typed in mph, stored in km/h. It used to say km/h whatever the setting.
describe('cardio speed in the profile\'s unit', () => {
  const bike = () => ({ id: BIKE, target: { mode: 'cardio', sets: 1, min: 20, speed: 8 }, sets: [{ min: 20, speed: 8, done: false }] })
  const field = label => host.querySelector(`input[aria-label="${label}"]`)
  const type = (input, value) => act(() => {
    Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  it('reads, steps and takes typing in mph for a profile in pounds, and stores km/h', () => {
    render([bike()], { unit: 'lb' })
    expect(field('mph').value).toBe('5')
    tap(labelled('More mph'))
    expect(setOf().speed).toBe(8.8)
    type(field('mph'), '6')
    expect(setOf().speed).toBe(9.66)
  })

  it('follows a chosen unit over the weight unit, and leaves km/h as it was', () => {
    render([bike()], { unit: 'kg', speedUnit: 'mph' })
    expect(field('mph')).toBeTruthy()
    unmount()
    render([bike()], { unit: 'lb', speedUnit: 'kmh' })
    expect(field('km/h').value).toBe('8')
    tap(labelled('More km/h'))
    expect(setOf().speed).toBe(8.5)
  })
})

describe('a burst', () => {
  it('uses the exercise\'s rest-pause duration for a new burst', () => {
    seed([{ id: SQUAT, target: { mode: 'reps', sets: 1, reps: 5, weight: 95, intensifier: { type: 'restpause', restSec: 7 } }, sets: [{ w: 95, r: 5, done: false }] }])
    act(() => addBurstAt(0, 0))
    expect(setOf().clusters[0].restSec).toBe(7)
  })
})

describe('re-checking a completed final set', () => {
  it('does not hand over to the next exercise', () => {
    seed([lift(BENCH, 80, 8, 1, { sets: [{ w: 80, r: 8, done: true }] }), lift(ROW, 40, 8, 1)])
    const hook = mountHook(useWorkout)
    try {
      act(() => hook.out.current.actions.toggle(0, 0))
      expect(setOf().done).toBe(false)
      act(() => hook.out.current.actions.toggle(0, 0))
      expect(setOf().done).toBe(true)
      expect(active().cur).toBe(0)
    } finally {
      hook.unmount()
    }
  })
})
