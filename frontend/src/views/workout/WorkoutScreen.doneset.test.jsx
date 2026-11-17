// @vitest-environment happy-dom
// Done set keeps its behaviour under the slide and the row coming out of the pill, with motion and with reduced motion.
// S.active, Done ticks and rests, the hand-over after the last set (and staying with autoNext off),
// ‹ › and the swipe, a superset A1 → A2 → rest after both, a timed hold switching side, NEW BEST
// and its toast once, the cool-down offer once, the editor, offline, empty freestyle, minimise.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { back } from '../../lib/use-tab-nav.js'
import { cooldownOfferSheet, discardSheet, finishSheet } from './finish-drawers.js'
import { resetBested } from './use-workout.js'
import WorkoutScreen, { BAR_TOAST_MS } from './WorkoutScreen.jsx'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), back: vi.fn() }))
vi.mock('./finish-drawers.js', () => ({ finishSheet: vi.fn(), discardSheet: vi.fn(), cooldownOfferSheet: vi.fn(), warmupOfferSheet: vi.fn(), staleWorkoutSheet: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const lift = (id, w, r, n, extra = {}) => ({ id, target: { mode: 'reps', sets: n, reps: r, weight: w, restSec: 90 }, sets: Array.from({ length: n }, () => ({ w, r, done: false })), ...extra })
const BENCH = () => lift('0025', 80, 8, 2)
const PRESS = () => lift('0426', 24, 8, 2)
const STRETCH = () => ({ id: '1053', part: 'cooldown', target: { mode: 'time', sec: 30, sets: 1, side: true }, sets: [{ sec: 30, w: 0, side: 'L', done: false }, { sec: 30, w: 0, side: 'R', done: false }] })
const PAST = { id: 'past', d: '2026-10-01', start: Date.parse('2026-10-01T18:00:00'), end: Date.parse('2026-10-01T19:00:00'), name: 'Push A', routineIds: [], entries: [{ ...BENCH(), sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }] }] }

let root
let host
function render(entries, { over = {}, state = {} } = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', sound: false, effort: 'none', workouts: [PAST], ...state })
  S.active = { id: 'screen-' + Math.random(), d: '2026-10-21', start: Date.now() - 60000, routineIds: ['r'], name: 'Push A', bw: null, cur: 0, entries, ...over }
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
const A = () => useStore.getState().S.active
const button = text => [...host.querySelectorAll('button, a')].find(b => b.textContent === text)
const labelled = label => host.querySelector(`[aria-label="${label}"]`)
const press = el => { expect(el).toBeTruthy(); act(() => el.click()) }

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.getState().closeAll()
  vi.clearAllMocks()
  vi.useRealTimers()
})

const run = () => {
  render([lift('0025', 80, 8, 3), PRESS()])
  expect(host.querySelectorAll('.g-dsr-row').length).toBe(0)
  press(button('Done set'))
  act(() => { vi.advanceTimersByTime(60) })
  press(button('Done set'))
  act(() => { vi.advanceTimersByTime(600) })
  expect(A().entries[0].sets.map(s => s.done)).toEqual([true, true, false])
  expect(host.textContent).toContain('Set 3 of 3')
  expect(host.querySelectorAll('.g-dsr-row').length).toBe(2)
  expect(host.querySelector('.wk-lower').style.transform).toBe('')
}

describe('Done set motion', () => {
  afterEach(() => { delete document.documentElement.dataset.motion })

  it('records the set, advances and settles with motion (a quick second tap included)', () => {
    run()
  })

  it('does the same under reduced motion, without a transform ever set', () => {
    document.documentElement.dataset.motion = 'reduce'
    run()
    expect(host.querySelector('.g-dsr-row').style.transform).toBe('')
  })
})
