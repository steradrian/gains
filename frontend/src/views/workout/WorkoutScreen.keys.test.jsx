// @vitest-environment happy-dom
// Hardware keys on the running workout (issue #133, guard-M1), ported from Workout.keys.test.jsx.
// The listener lives in `useWorkout` (its keys effect), so these mount the hook and press keys on
// the document: what a key does to the session, not only what lib/workout-keys.js decides. The
// list-scroll case (Workout.keys:103) is dropped by design: the screen has no list.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { resetBested, useWorkout } from './use-workout.js'
import { active, lift, mountHook, resetTimers, seed, timed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/', IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** An exercise whose sets are `done` flags, 60 kg x 5. */
const entry = (id, done) => ({
  ...lift(id, 60, 5, done.length),
  sets: done.map(d => ({ w: 60, r: 5, done: d })),
})
const BENCH = '0025'
const PRESS = '0426'
const ROW = '0334'

let hook
function start(entries, opts) {
  seed(entries, opts)
  hook = mountHook(useWorkout)
}
const press = (key, target = document.body) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => { target.dispatchEvent(event) })
  return event
}
const doneOf = idx => active().entries[idx].sets.map(s => s.done)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  resetBested()
  useUI.setState({ sheets: [] })
})
afterEach(() => {
  hook?.unmount()
  hook = null
  resetTimers()
  vi.clearAllTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('workout keys (issue #133)', () => {
  it('Space ticks the next open set of the current exercise and starts its rest', () => {
    start([entry(BENCH, [true, false, false]), entry(PRESS, [false])])
    const event = press(' ')
    expect(event.defaultPrevented).toBe(true) // the page does not scroll as well
    expect(doneOf(0)).toEqual([true, true, false])
    expect(useUI.getState().timer).not.toBeNull()
  })

  it('Space and Enter tick through the same handler', () => {
    start([entry(BENCH, [false, false, false]), entry(PRESS, [false])])
    press(' ')
    press('Enter')
    expect(doneOf(0)).toEqual([true, true, false])
  })

  it('once the exercise on screen is finished, a press brings up the next one and the next press ticks it', () => {
    start([entry(BENCH, [true]), entry(PRESS, [false, false])], { autoNext: false })
    press(' ')
    expect(active().cur).toBe(1)
    expect(doneOf(1)).toEqual([false, false])
    press(' ')
    expect(doneOf(1)).toEqual([true, false])
  })

  it('the arrows switch exercise', () => {
    start([entry(BENCH, [false]), entry(PRESS, [false]), entry(ROW, [false])])
    press('ArrowRight')
    expect(active().cur).toBe(1)
    press('ArrowRight')
    expect(active().cur).toBe(2)
    press('ArrowRight')
    expect(active().cur).toBe(2)
    press('ArrowLeft')
    expect(active().cur).toBe(1)
    expect([0, 1, 2].flatMap(doneOf)).toEqual([false, false, false])
  })

  it('keys typed into a set\'s field stay in the field', () => {
    start([entry(BENCH, [false, false]), entry(PRESS, [false])])
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    try {
      for (const key of [' ', 'Enter', 'ArrowRight']) expect(press(key, input).defaultPrevented).toBe(false)
    } finally {
      input.remove()
    }
    expect(doneOf(0)).toEqual([false, false])
    expect(active().cur).toBe(0)
  })

  it('does nothing while a sheet is open on top', () => {
    start([entry(BENCH, [false]), entry(PRESS, [false])])
    useUI.getState().openSheet(() => null)
    press(' ')
    press('ArrowRight')
    expect(doneOf(0)).toEqual([false])
    expect(active().cur).toBe(0)
  })

  it('a timed set is started rather than ticked, and the next press is its Done', () => {
    start([timed('1053', 45, 1)])
    press(' ')
    expect(useUI.getState().work).not.toBeNull()
    expect(doneOf(0)).toEqual([false])
    act(() => { vi.advanceTimersByTime(10_000) })
    press(' ')
    expect(useUI.getState().work).toBeNull()
    expect(doneOf(0)).toEqual([true])
    expect(active().entries[0].sets[0].sec).toBe(10)
  })

  it('a second press right after it starts a hold does not log the hold at a second', () => {
    // A USB button that bounces, or a double press.
    start([timed('1053', 45, 1)])
    press(' ')
    act(() => { vi.advanceTimersByTime(200) })
    const second = press(' ')
    expect(second.defaultPrevented).toBe(true) // still the workout's key, it just does nothing
    expect(useUI.getState().work).not.toBeNull()
    expect(doneOf(0)).toEqual([false])
    act(() => { vi.advanceTimersByTime(2_000) })
    press(' ')
    expect(useUI.getState().work).toBeNull()
    expect(doneOf(0)).toEqual([true])
    expect(active().entries[0].sets[0].sec).toBe(2)
  })

  it('stops listening when the workout screen goes away', () => {
    start([entry(BENCH, [false])])
    hook.unmount()
    hook = null
    press(' ')
    expect(doneOf(0)).toEqual([false])
  })
})
