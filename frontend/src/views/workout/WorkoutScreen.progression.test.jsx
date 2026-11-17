// @vitest-environment happy-dom
// Progression on the running workout (boards W1.47 to W1.52, spec W1.0 and PR03Edges): the line under
// the hero, the rules that hide it, a tap on it opening Exercise settings, the dashed "not counted"
// line with Undo for an exercise and for the whole workout, and a dumbbell weight read per bell.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { workoutVolume } from '../../lib/history.js'
import { resetBested } from './use-workout.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import { progressionOf, setFields, setText } from './workout-view.js'
import { active, lift, resetTimers, seed, stretch, timed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const BENCH = '0025'
const DB_PRESS = '0289' // dumbbell bench press
const UP = { policy: 'double', kind: 'up', weight: 22.5, why: ['Every rep last time. {0} {1} more.', 2.5, 'kg'] }
const DELOAD = { policy: 'double', kind: 'deload', weight: 22, why: ['Missed reps. Reset to {0} {1} and work back up.', 22, 'kg'] }
const PAST = [{
  id: 'p1', d: '2026-10-15', start: Date.parse('2026-10-15T18:00:00'), end: Date.parse('2026-10-15T19:00:00'), name: 'Push A', routineIds: [],
  entries: [{ id: BENCH, target: { mode: 'reps', sets: 3, reps: 8, weight: 60 }, sets: [{ w: 60, r: 8, done: true }] }],
}]

let root
let host
function render(entries, opts = {}) {
  seed(entries, { workouts: PAST, ...opts })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
// The drawer on top of the stack, rendered the way the app's sheet host does.
const sheets = []
function openSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const r = createRoot(el)
  sheets.push([r, el])
  act(() => r.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return el
}
const line = () => host.querySelector('.g-prog')
const skipped = () => host.querySelector('.g-nc')
const undo = () => host.querySelector('.g-nc-undo')

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  act(() => { sheets.splice(0).forEach(([r, el]) => { r.unmount(); el.remove() }) })
  act(() => root?.unmount())
  host?.remove()
  root = null
  resetTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the progression line', () => {
  it('says the policy in bold and the reason under the hero, above the sets, named by the whole sentence', () => {
    render([lift(BENCH, 60, 8, 3, { plan: UP })])
    expect(line().querySelector('b').textContent).toBe('Double progression')
    expect(line().textContent).toBe('Double progression · Every rep last time. 2.5 kg more.')
    expect(line().getAttribute('aria-label')).toBe('Double progression. Every rep last time. 2.5 kg more. Opens exercise settings')
    expect(line().querySelector('svg').getAttribute('data-icon')).toBe('arrowUp')
    const hero = host.querySelector('.g-xh')
    expect(hero.compareDocumentPosition(line()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line().compareDocumentPosition(host.querySelector('.wk-done')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reads a hold with the bulb and a deload in the warning tone with the arrow down', () => {
    render([lift(BENCH, 60, 8, 3, { plan: { policy: 'double', kind: 'hold', weight: 60, why: ['Same weight, aim for {0} reps this time.', 8] } })])
    expect(line().querySelector('svg').getAttribute('data-icon')).toBe('lightbulb')
    expect(line().className).not.toContain('g-prog-warning')
    act(() => root.unmount())
    render([lift(BENCH, 60, 8, 3, { plan: DELOAD })])
    expect(line().querySelector('svg').getAttribute('data-icon')).toBe('arrowDown')
    expect(line().className).toContain('g-prog-warning')
  })

  it('opens Exercise settings when tapped, with today\'s reason and "Don\'t count today" in it', () => {
    render([lift(BENCH, 60, 8, 3, { plan: UP })])
    act(() => line().click())
    expect(useUI.getState().sheets).toHaveLength(1)
    const sheet = openSheet()
    expect(sheet.textContent).toContain('Today: Every rep last time. 2.5 kg more.')
    const row = [...sheet.querySelectorAll('.lrow')].find(r => r.textContent.includes('Don’t count today'))
    act(() => row.querySelector('[role="switch"]').click())
    expect(active().entries[0].noProg).toBe(true)
    expect(skipped()).toBeTruthy()
    expect(line()).toBeNull()
  })

  it('goes away when the policy is set to none and saved', () => {
    render([lift(BENCH, 60, 8, 3, { plan: UP })])
    act(() => line().click())
    const sheet = openSheet()
    act(() => [...sheet.querySelectorAll('button')].find(b => b.textContent === 'No automatic progression').click())
    act(() => [...sheet.querySelectorAll('button')].find(b => b.textContent === 'Done').click())
    expect(active().entries[0].plan.kind).toBe('off')
    expect(line()).toBeNull()
    expect(skipped()).toBeNull()
  })

  it('sits between the hero and the ring on a timed hold', () => {
    const past = { ...PAST[0], entries: [{ id: '1053', target: { mode: 'time', sec: 30, sets: 2 }, sets: [{ sec: 30, w: 0, done: true }] }] }
    render([timed('1053', 30, 2, { plan: { policy: 'time', kind: 'up', sec: 35, why: ['Held every set for the full time. Target goes up by {0}s.', 5] } })], { workouts: [past] })
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Start')).click())
    const ring = host.querySelector('.g-th')
    expect(ring).toBeTruthy()
    expect(host.querySelector('.g-xh').compareDocumentPosition(line()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line().compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line().textContent).toContain('Target goes up by 5s.')
  })

  it('draws nothing, and keeps no space, when progression is off, on a warm-up or cool-down, and the first time', () => {
    const S = seed([lift(BENCH, 60, 8, 3, { plan: { policy: 'off', kind: 'off' } })])
    const entry = e => progressionOf(S, S.active, e)
    expect(entry(lift(BENCH, 60, 8, 3, { plan: { policy: 'off', kind: 'off' } }))).toBeNull()
    expect(entry(lift(BENCH, 60, 8, 3))).toBeNull()
    expect(entry(lift(BENCH, 0, 10, 2, { part: 'warmup', plan: UP }))).toBeNull()
    expect(entry({ ...stretch(), plan: UP })).toBeNull()
    expect(entry(lift(BENCH, 60, 8, 3, { plan: { policy: 'double', kind: 'first', why: ['Nothing logged yet, so this session sets the baseline.'] } }))).toBeNull()
    render([lift(BENCH, 60, 8, 3, { plan: { policy: 'off', kind: 'off' } })])
    expect(line()).toBeNull()
    expect(skipped()).toBeNull()
  })

  it('leaves it to "New to you · how to" when the exercise was never logged', () => {
    render([lift('0188', 20, 10, 3, { plan: UP })], { workouts: [] })
    expect(host.textContent).toContain('New to you · how to')
    expect(line()).toBeNull()
  })

  it('keeps a long reason whole for the screen reader, and in the text for the two-line clamp to cut', () => {
    const long = 'You’ve outgrown the rack: {0} {1} is your heaviest dumbbell, so the weight stays.'
    render([lift(BENCH, 60, 8, 3, { plan: { policy: 'double', kind: 'hold', weight: 24, why: [long, 24, 'kg'] } })])
    expect(line().getAttribute('aria-label')).toContain('24 kg is your heaviest dumbbell, so the weight stays.')
    expect(line().querySelector('.g-prog-text').textContent).toContain('24 kg is your heaviest dumbbell')
  })
})

describe('Not counted for progression (W1.50, W1.51)', () => {
  it('replaces the line for a kept-out exercise with a dashed line and Undo, which counts it again', () => {
    render([lift(BENCH, 60, 8, 3, { plan: UP, noProg: true }), lift(BENCH, 60, 8, 3, { plan: UP })])
    expect(line()).toBeNull()
    expect(skipped().textContent).toContain('Not counted for progression today')
    expect(undo().getAttribute('aria-label')).toBe('Undo, count it again')
    act(() => undo().click())
    expect(active().entries[0].noProg).toBeUndefined()
    expect(skipped()).toBeNull()
    expect(line()).toBeTruthy()
  })

  it('shows a deload routine\'s kept-out exercise with no button to undo', () => {
    render([lift(BENCH, 60, 8, 3, { rid: 'deload', noProg: true, plan: { policy: 'off', kind: 'off' } })],
      { routines: [{ id: 'deload', name: 'Deload', excludeFromProgression: true, ex: [] }] })
    expect(skipped().textContent).toContain('Not counted for progression today')
    expect(undo()).toBeNull()
  })

  it('says the whole workout is left out, under the title as well, and Undo counts every exercise again', () => {
    render([lift(BENCH, 60, 8, 3, { plan: UP }), lift(BENCH, 60, 8, 3, { plan: UP })], { active: { noProg: true } })
    act(() => useStore.getState().update(s => { s.active.entries.forEach(e => { e.noProg = true }) }))
    expect(skipped().textContent).toContain('The whole workout is left out of progression')
    expect(host.querySelector('.g-wtop-status').textContent).toBe('Not counted for progression')
    act(() => undo().click())
    expect(active().noProg).toBeUndefined()
    expect(active().entries.every(e => e.noProg === undefined)).toBe(true)
    expect(skipped()).toBeNull()
    expect(host.querySelector('.g-wtop-status')).toBeNull()
  })

  it('does not draw on a warm-up or cool-down', () => {
    render([lift(BENCH, 0, 10, 2, { part: 'warmup', noProg: true })])
    expect(skipped()).toBeNull()
  })
})

describe('dumbbells logged per bell (W1.52)', () => {
  const press = (dbLoad, extra = {}) => lift(DB_PRESS, 22, 8, 3, { plan: UP, ...extra, target: { mode: 'reps', sets: 3, reps: 8, weight: 22, dbLoad } })

  it('reads sets "22 each × 8", the hero "at 22 kg each" and the stepper "kg each"', () => {
    render([press('each')])
    expect(host.querySelector('.g-xh-meta').textContent).toContain('3 × 8 at 22 kg each')
    expect(host.querySelector('button[aria-label="More kg each"]')).toBeTruthy()
    const S = useStore.getState().S
    expect(setText(S, active().entries[0], active().entries[0].sets[0])).toBe('22 each × 8')
    expect(setFields(S, active().entries[0], 0).fields[0].label).toBe('kg each')
  })

  it('reads as it always did when the weight is as entered, both together, or one arm', () => {
    render([press(undefined)])
    expect(host.querySelector('.g-xh-meta').textContent).toContain('at 22 kg')
    expect(host.querySelector('.g-xh-meta').textContent).not.toContain('each')
    const S = useStore.getState().S
    expect(setText(S, active().entries[0], active().entries[0].sets[0])).toBe('22 kg × 8')
    expect(setText(S, { ...press('total') }, { w: 22, r: 8 })).toBe('22 kg × 8')
    expect(setText(S, { ...press('each'), id: '0292' }, { w: 22, r: 8 })).toBe('22 kg × 8')
  })

  it('counts both dumbbells in volume however the weight is logged', () => {
    const volume = e => workoutVolume({ entries: [{ ...e, sets: [{ w: 20, r: 10, done: true }] }] })
    expect(volume(press('each'))).toBe(2 * volume(press('total')))
    expect(volume(press('total'))).toBe(200)
  })
})
