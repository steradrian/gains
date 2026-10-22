// @vitest-environment happy-dom
// The rest on the running screen's footer (guard-M1), ported from components/RestTimer.dock.test.jsx
// and RestTimer.ready.test.jsx. The docked bar is `WorkoutFooter` now: the centre is the countdown
// ring ("1:30 / Rest", spoken "Rest, 1:30 left. Change"), and one row rises above it, -15 s, +15 s,
// pause, Skip; after the rest the centre says Ready and the row holds +15 s and Go. What the wheel's
// Done does to the rest is `applyRestLeft` (components/RestTimer.jsx), tested here against the store.
// Dropped by design: RestTimer.dock:81 (Skip as a narrow icon, Dismiss as an x): the footer has one form.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { applyRestLeft } from '../../components/RestTimer.jsx'
import { resetBested } from './use-workout.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import { lift, resetTimers, seed, timed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let host
const mount = () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
const unmount = () => { act(() => root.unmount()); host.remove(); root = null }
/** Seeds a session with a rest already running (`sec`, for exercise `forIdx`) and mounts the screen. */
function renderResting(sec, forIdx = 0, entries = [lift('0025', 80, 8, 3), lift('0426', 24, 8, 2)]) {
  seed(entries, { autoNext: false })
  act(() => useUI.getState().startRest(sec, forIdx))
  mount()
}
const labelled = label => host.querySelector(`[aria-label="${label}"]`)
const rowLabels = () => [...host.querySelectorAll('.g-wf-restrow button')].map(b => b.getAttribute('aria-label'))
const clock = () => host.querySelector('.g-wf-rt b').textContent
const timer = () => useUI.getState().timer
const advance = ms => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  if (root) unmount()
  resetTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the rest in the footer', () => {
  it('is one row above the bar: the clock with its label, then -15, +15, pause and Skip', () => {
    renderResting(90)
    expect(clock()).toBe('1:30')
    expect(host.querySelector('.g-wf-rt span').textContent).toBe('Rest')
    expect(labelled('Rest, 1:30 left. Change')).toBeTruthy()
    expect(rowLabels()).toEqual(['15 seconds less', '15 seconds more', 'Pause rest', 'Skip rest'])
  })

  it('turns to Ready with +15 s and Go in the row, and no pause', () => {
    renderResting(1)
    advance(1000)
    expect(timer().ready).toBe(true)
    expect(host.querySelector('.g-wf-ready b').textContent).toBe('Ready')
    expect(host.querySelector('.g-wf-ready').textContent).toContain('Rest is over')
    expect(rowLabels()).toEqual(['15 seconds more', 'Start the next set'])
    expect(labelled('Pause rest')).toBeNull()
  })

  it('keeps Ready across a remount, and Go dismisses it', () => {
    renderResting(1, 1)
    advance(1000)
    unmount()
    mount()
    expect(host.querySelector('.g-wf-ready b').textContent).toBe('Ready')
    expect(timer().forIdx).toBe(1)
    act(() => labelled('Start the next set').click())
    expect(timer()).toBeNull()
  })

  it('pauses the countdown, swaps the button to Resume, and resumes from the same second', () => {
    renderResting(90)
    advance(10_000)
    expect(clock()).toBe('1:20')
    act(() => labelled('Pause rest').click())
    expect(labelled('Resume rest')).toBeTruthy()
    expect(timer().paused).toBe(true)
    advance(60_000)
    expect(clock()).toBe('1:20')
    act(() => labelled('Resume rest').click())
    advance(20_000)
    expect(clock()).toBe('1:00')
  })

  it('offers no pause on the timed hold', () => {
    seed([timed('1053', 30, 1)])
    mount()
    act(() => useUI.getState().startWork(30, 'Hold', vi.fn()))
    expect(labelled('Pause rest')).toBeNull()
  })

  it('opens the wheel at the time left from the clock', () => {
    renderResting(90, 3)
    advance(10_000)
    act(() => labelled('Rest, 1:20 left. Change').click())
    const sheet = useUI.getState().sheets.at(-1)
    expect(sheet).toBeTruthy()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    act(() => r.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    expect(el.textContent).toContain('Time left')
    act(() => r.unmount())
    el.remove()
  })

  it('+15 s stops at the wheel maximum of 15:00', () => {
    renderResting(890)
    act(() => labelled('15 seconds more').click())
    expect(timer()).toMatchObject({ left: 900, total: 900 })
    act(() => labelled('15 seconds more').click())
    expect(timer().left).toBe(900)
    act(() => labelled('15 seconds less').click())
    expect(timer().left).toBe(885)
  })

  it('Skip ends the rest', () => {
    renderResting(90)
    act(() => labelled('Skip rest').click())
    expect(timer()).toBeNull()
  })

  it('counts a switch-sides pause down and goes without a Ready or a toast', () => {
    seed([timed('1053', 30, 2)])
    useUI.setState({ toastMsg: '' })
    act(() => useUI.getState().startRest(10, 0, { kind: 'switch' }))
    mount()
    expect(clock()).toBe('0:10')
    advance(10_000)
    expect(timer()).toBeNull()
    expect(useUI.getState().toastMsg).toBe('')
    expect(host.querySelector('.g-wf-ready')).toBeNull()
    expect(host.querySelector('.g-wf-rest')).toBeNull()
  })

  // Old RestTimer.ready:55: an opted-in hold that runs past its end shows a plus clock ("+0:03")
  // and an empty ring, and keeps going until Done.
  it('shows a plus clock and an empty ring during opted-in overtime', () => {
    seed([timed('1053', 10, 2)], { timedSetOvertime: true })
    mount()
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Start · 0:10').click())
    advance(10_000)
    expect(host.querySelector('.g-th-c b').textContent).toBe('0:00')
    advance(3_000)
    expect(useUI.getState().work).toMatchObject({ left: -3, overtime: true })
    expect(host.querySelector('.g-th-c b').textContent).toBe('+0:03')
    const arc = host.querySelector('.g-th-arc')
    expect(Number(arc.style.getPropertyValue('--o'))).toBeCloseTo(Number(arc.style.getPropertyValue('--c')))
  })

  // Old RestTimer.dock:102: the label under the clock says Paused while the rest is held; the
  // spoken name of the clock keeps saying Rest.
  it('says Paused under the clock while the rest is held', () => {
    renderResting(90)
    act(() => labelled('Pause rest').click())
    expect(timer().paused).toBe(true)
    expect(host.querySelector('.g-wf-rt span').textContent).toBe('Paused')
    expect(labelled('Rest, 1:30 left. Change')).toBeTruthy()
    act(() => labelled('Resume rest').click())
    expect(host.querySelector('.g-wf-rt span').textContent).toBe('Rest')
  })

  // Old RestTimer.ready:104: the pause between the two sides of a hold is not a "Rest".
  it('names the switch-sides pause', () => {
    seed([timed('1053', 30, 2)])
    act(() => useUI.getState().startRest(10, 0, { kind: 'switch' }))
    mount()
    expect(host.querySelector('.g-wf-rt span').textContent).toBe('Switch sides')
    expect(labelled('Switch sides, 0:10 left. Change')).toBeTruthy()
  })
})

describe('what the wheel\'s Done does to the rest (applyRestLeft)', () => {
  beforeEach(() => seed([lift('0025', 80, 8, 3)]))

  it('sets the rest to what was picked', () => {
    act(() => useUI.getState().startRest(90, 3))
    advance(10_000)
    act(() => applyRestLeft(120))
    expect(timer()).toMatchObject({ left: 120, forIdx: 3 })
  })

  it('ends the rest at 0:00, and starts a fresh one when the old one had run out', () => {
    act(() => useUI.getState().startRest(30, 1))
    act(() => applyRestLeft(0))
    expect(timer()).toBeNull()

    act(() => useUI.getState().startRest(1, 2))
    advance(1000)
    expect(timer().ready).toBe(true)
    act(() => applyRestLeft(45))
    expect(timer()).toMatchObject({ left: 45, total: 45, forIdx: 2 })
    expect(timer().ready).toBeUndefined()
  })

  it('leaves the rest alone on an untouched wheel', () => {
    // still counting: the seconds that passed while the wheel was open are not given back
    act(() => useUI.getState().startRest(60, 0))
    advance(10_000)
    act(() => applyRestLeft(60, 60))
    expect(timer().left).toBe(50)

    // ran out meanwhile: no fresh rest nobody asked for
    act(() => useUI.getState().startRest(5, 2))
    advance(5000)
    expect(timer().ready).toBe(true)
    act(() => applyRestLeft(0, 0))
    expect(timer()).toMatchObject({ ready: true, left: 0 })

    // a switch-sides pause that ended does not turn into a plain rest
    act(() => useUI.getState().startRest(5, 1, { kind: 'switch' }))
    advance(5000)
    expect(timer()).toBeNull()
    act(() => applyRestLeft(5, 5))
    expect(timer()).toBeNull()
  })

  it('keeps a paused rest paused at the new time', () => {
    act(() => useUI.getState().startRest(90, 0))
    act(() => useUI.getState().pauseRest())
    act(() => applyRestLeft(60))
    expect(timer()).toMatchObject({ left: 60, paused: true })
  })
})
