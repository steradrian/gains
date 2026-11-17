// @vitest-environment happy-dom
// The running workout screen (core-M3) against the real store and timers: each state from a seeded
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

describe('WorkoutScreen', () => {
  it('renders the exercise, its set and the footer from a seeded session', () => {
    render([BENCH(), PRESS()])
    expect(host.textContent).toContain('Set 1 of 2')
    expect(host.textContent).toContain('Done set')
    expect(host.textContent).toContain('1 of 2')
    expect(host.querySelector('.g-xh-name').textContent).toMatch(/bench press/i)
  })

  it('ticks a set with Done and starts its rest in the footer', () => {
    render([BENCH(), PRESS()])
    press(button('Done set'))
    expect(A().entries[0].sets[0].done).toBe(true)
    expect(useUI.getState().timer).not.toBeNull()
    expect(host.querySelector('.g-wf-rest')).not.toBeNull()
  })

  it('hands over to the next exercise after the last set, with a bar toast whose Back returns', () => {
    render([BENCH(), PRESS()], { over: { cur: 0 } })
    press(button('Done set'))
    press(button('Done · last set'))
    expect(A().cur).toBe(1)
    expect(host.querySelector('.g-btoast').textContent).toMatch(/done/)
    press(button('Back'))
    expect(A().cur).toBe(0)
  })

  it('stays on the finished exercise when autoNext is off', () => {
    render([BENCH(), PRESS()], { state: { autoNext: false } })
    press(button('Done set'))
    press(button('Done · last set'))
    expect(A().cur).toBe(0)
    expect(host.textContent).toContain('Tap a set to fix it, or add one more.')
  })

  it('moves along with ‹ › and with a sideways swipe on the hero', () => {
    render([BENCH(), PRESS()])
    press(host.querySelector('a.g-wf-nb, button.g-wf-nb'))
    expect(A().cur).toBe(1)
    const hero = host.querySelector('.g-xh')
    act(() => {
      hero.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 50, clientY: 100 }))
      hero.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 200, clientY: 100 }))
    })
    expect(A().cur).toBe(0)
  })

  it('runs a superset A1 → A2, then the rest after both', () => {
    render([lift('0334', 8, 15, 2, { sg: 'A' }), lift('0201', 30, 12, 2, { sg: 'A' })])
    expect(host.textContent).toContain('A1 · round 1 of 2')
    press(button('Done · go to A2'))
    expect(A().cur).toBe(1)
    expect(useUI.getState().timer).toBeNull()
    press(button('Done · rest 1:30 after both'))
    expect(useUI.getState().timer).not.toBeNull()
    // The older toast first: A2's new best, then the round, each for BAR_TOAST_MS.
    expect(host.querySelector('.g-btoast').textContent).toContain('New best')
    act(() => { vi.advanceTimersByTime(BAR_TOAST_MS) })
    expect(host.querySelector('.g-btoast').textContent).toContain('Round 1 done')
  })

  it('holds a timed stretch, and Switch side ends the left and starts the right on its own', () => {
    render([STRETCH()], { over: { offered: { cooldown: true } } })
    press(button('Start · 0:30'))
    expect(useUI.getState().work).not.toBeNull()
    expect(host.textContent).toContain('Left side')
    press(button('Switch side'))
    expect(A().entries[0].sets[0].done).toBe(true)
    expect(useUI.getState().timer?.kind).toBe('switch')
    act(() => { vi.advanceTimersByTime(11000) })
    expect(useUI.getState().work).not.toBeNull()
    expect(host.textContent).toContain('Right side')
  })

  it('pauses and resumes the hold', () => {
    render([STRETCH()], { over: { offered: { cooldown: true } } })
    press(button('Start · 0:30'))
    press(button('Pause'))
    expect(useUI.getState().work.paused).toBe(true)
    const left = useUI.getState().work.left
    act(() => { vi.advanceTimersByTime(5000) })
    expect(useUI.getState().work.left).toBe(left)
    press(button('Resume'))
    expect(useUI.getState().work.paused).toBeUndefined()
  })

  it('marks a set that beats every past session NEW BEST, with the Trend toast once', () => {
    const bench = BENCH()
    bench.sets[0].w = 85
    bench.sets[1].w = 90
    render([bench, PRESS()])
    press(button('Done set'))
    expect(host.textContent).toContain('NEW BEST')
    expect(button('Trend')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(BAR_TOAST_MS + 50) })
    expect(button('Trend')).toBeFalsy()
    press(button('Done · last set'))
    expect(host.querySelector('.g-btoast')?.textContent || '').not.toContain('New best')
  })

  it('opens the cool-down offer once when the last working set is done', () => {
    render([lift('0025', 80, 8, 1), STRETCH()])
    press(button('Done · last set'))
    // The sheet marks the offer as made (finish-drawers.test.jsx), so the screen asks once and it is mocked here.
    expect(cooldownOfferSheet).toHaveBeenCalledTimes(1)
  })

  it('edits a saved workout without timers, and Save saves', () => {
    const bench = BENCH()
    bench.sets.forEach(s => { s.done = true })
    render([bench], { over: { editingWorkoutId: 'past', d: '2026-10-01' } })
    // No status row that says nothing: the top bar already says Editing, with the date.
    expect(host.textContent).not.toContain('Editing a saved workout')
    expect(host.textContent).toContain('Set 1 · editing')
    expect(host.querySelector('.wk-link')).toBeNull()
    expect([...host.querySelectorAll('.g-drow')].some(r => r.textContent.includes('Set options'))).toBe(true)
    expect(button('Save changes')).toBeTruthy()
    expect(host.querySelector('.g-wf-rest')).toBeNull()
    expect(labelled('Close editor')).toBeTruthy()
  })

  it('says Offline with the count, or only Offline when it is unknown', () => {
    useStore.setState({ sync: { ...useStore.getState().sync, offline: true }, unsyncedChanges: () => ({ count: 6 }) })
    render([BENCH()])
    expect(host.textContent).toContain('Offline · 6 waiting')
    act(() => root.unmount())
    useStore.setState({ unsyncedChanges: () => ({ count: null }) })
    host = document.createElement('div')
    root = createRoot(host)
    act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
    expect(host.textContent).toContain('Offline')
    expect(host.textContent).not.toContain('waiting')
    useStore.setState({ sync: { ...useStore.getState().sync, offline: false } })
  })

  it('shows Pick as you go for an empty freestyle session, whose pill discards', () => {
    render([], { over: { routineIds: [], name: 'Empty workout' } })
    expect(host.textContent).toContain('Pick as you go')
    expect(host.querySelector('.g-sempty').classList.contains('g-glass')).toBe(false)
    press(button('Discard'))
    expect(discardSheet).toHaveBeenCalled()
  })

  it('minimises with ⌄ and never discards; Finish opens the finish drawer', () => {
    render([BENCH()])
    press(labelled('Minimise'))
    expect(back).toHaveBeenCalled()
    expect(A()).not.toBeNull()
    press(button('Finish'))
    expect(finishSheet).toHaveBeenCalled()
  })
})
