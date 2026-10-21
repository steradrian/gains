// @vitest-environment happy-dom
// The end of a hold on the running screen (guard-M1), ported from Workout.hold.test.jsx, against
// the real store and work timer: it sounds once. The chime and its buzz pattern belong to the
// timer (store/useUI.js); the set it ticks adds neither its own beep, which clipped the chime's
// first note, nor its short buzz, which cut the pattern off. A per-side hold pauses ten seconds
// to switch sides, then rests in full once both are held. The "Left and Right pills one width"
// case (Workout.hold:123, #322) is dropped by design: TimedHold names the side in one label.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { alertBuzz, beep, chime, vibrate } from '../../lib/sound.js'
import { resetBested } from './use-workout.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import { resetTimers, seed, timed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let host
function render(entries) {
  seed(entries, { sound: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const startHold = () => {
  const go = button('Start · 0:10')
  expect(go).toBeTruthy()
  act(() => go.click())
  expect(useUI.getState().work).not.toBeNull()
}
const tickBeeps = () => beep.mock.calls.filter(call => call[1] === 1040)
const doneOf = () => useStore.getState().S.active.entries[0].sets.map(s => s.done)

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  resetTimers()
  vi.clearAllTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the end of a hold', () => {
  it('ran out on its own: the chime and its buzz pattern, and no tick beep or short buzz after them', () => {
    render([timed('1053', 10, 2)])
    startHold()
    act(() => { vi.advanceTimersByTime(11_000) })
    expect(doneOf()).toEqual([true, false])
    expect(chime).toHaveBeenCalledOnce()
    expect(tickBeeps()).toEqual([])
    // The end's buzz goes through alertBuzz, which can buzz as an alarm on silent (#375).
    expect(alertBuzz.mock.calls).toEqual([[[200, 100, 200]]])
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('finished early with Done: the set ticks the way a tap does, beep and buzz', () => {
    render([timed('1053', 10, 2)])
    startHold()
    act(() => { vi.advanceTimersByTime(4_000) })
    act(() => useUI.getState().finishWorkEarly())
    expect(doneOf()).toEqual([true, false])
    expect(chime).not.toHaveBeenCalled()
    expect(tickBeeps()).toHaveLength(1)
    expect(vibrate).toHaveBeenLastCalledWith(30)
  })
})

// Owner's call: a timed per-side set pauses ten seconds to switch sides between its left and
// right hold, and rests in full only once both are held.
describe('a per-side hold', () => {
  const sidePlank = () => ({
    id: '1053',
    target: { mode: 'time', sets: 2, sec: 10, side: true, weight: 0 },
    sets: ['L', 'R', 'L', 'R'].map(side => ({ sec: 10, w: 0, done: false, side })),
  })

  it('left held: a 10 s "Switch sides" countdown, which ends with the chime and goes', () => {
    render([sidePlank()])
    startHold()
    act(() => { vi.advanceTimersByTime(11_000) })
    expect(doneOf()).toEqual([true, false, false, false])
    expect(useUI.getState().timer).toMatchObject({ kind: 'switch', total: 10 })
    expect(chime).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(useUI.getState().timer).toBeNull()
    expect(chime).toHaveBeenCalledTimes(2)
    expect(alertBuzz).toHaveBeenCalledTimes(2)
  })

  it('right held too: the set\'s full rest, not another switch', () => {
    render([sidePlank()])
    startHold()
    act(() => { vi.advanceTimersByTime(11_000) })
    // The switch countdown ends and the screen starts the right side on its own.
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(useUI.getState().work).not.toBeNull()
    act(() => { vi.advanceTimersByTime(11_000) })
    expect(doneOf()).toEqual([true, true, false, false])
    const timer = useUI.getState().timer
    expect(timer.kind).toBeUndefined()
    expect(timer.total).toBe(useStore.getState().S.restSec)
  })
})
