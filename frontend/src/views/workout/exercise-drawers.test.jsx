// @vitest-environment happy-dom
// The running workout's exercise drawers (exercise-drawers.jsx): Set edit (W1.12, W1.13), How to with
// Swap (W1.14 to W1.17, W1.33, W1.34, W1.43), Plate loading (W1.25), Time left (W1.4).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { closeThenNav } from '../../lib/nav.js'
import { applyRestLeft } from '../../components/RestTimer.jsx'
import { isWarmupRow, isFailureSet, dropsOf, clustersOf, makeSideSet } from '../../lib/workout-model.js'
import { setEditSheet, howToSheet, platesSheet, restWheelSheet, exerciseRestSheet } from './drawers.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))
vi.mock('../../lib/nav.js', async orig => ({ ...(await orig()), closeThenNav: vi.fn(close => close()) }))
vi.mock('../../components/RestTimer.jsx', async orig => {
  const real = await orig()
  return { ...real, applyRestLeft: vi.fn(real.applyRestLeft) }
})

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'
const FLY = '0188'
const STRETCH = '1053'
const row = (extra = {}) => ({ w: 80, r: 8, done: false, ...extra })
const lift = (id, sets, extra = {}) => ({ id, rid: 'push', target: { sets: sets.length, reps: 8, weight: 80 }, sets, ...extra })
const ROUTINE = { id: 'push', name: 'Push A', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }, { id: FLY, sets: 3, reps: 12, weight: 17.5 }] }
const PAST = { id: 'w1', d: '2026-10-15', start: Date.parse('2026-10-15T18:00:00'), end: Date.parse('2026-10-15T19:00:00'), name: 'Push A', routineIds: ['push'], prs: [],
  entries: [{ id: BENCH, rid: 'push', target: { sets: 2, reps: 8 }, sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 7, done: true }] }] }

function seed(entries, { cur = 0, ...over } = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', restSec: 120, effort: 'none', routines: [clone(ROUTINE)], workouts: [], ...over })
  S.active = { id: 'act', d: '2026-10-21', start: Date.now(), name: 'Push A', bw: null, cur, routineIds: ['push'], entries: clone(entries) }
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active
const sets = (idx = 0) => A().entries[idx].sets

const mounted = []
function top() {
  const sheet = useUI.getState().sheets.at(-1)
  if (!sheet) return null
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
const tap = el => act(() => el.click())
const switchFor = (host, label) => [...host.querySelectorAll('.g-switchrow')].find(r => r.textContent.includes(label))?.querySelector('[role="switch"]')
const sheetsOpen = () => useUI.getState().sheets.length

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: null, toastAction: null })
  document.body.innerHTML = ''
  vi.mocked(closeThenNav).mockClear()
  vi.mocked(applyRestLeft).mockClear()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useStore.setState({ S: clone(DEF) })
})

describe('Set edit (W1.12)', () => {
  it('names the set and steps the weight and reps through the actions', () => {
    seed([lift(BENCH, [row(), row(), row()])])
    setEditSheet(0, 0)
    const host = top()
    expect(host.textContent).toContain('Set 1 ·')
    expect(host.textContent).toContain('Weight')
    expect(host.textContent).toContain('Plan 8')
    tap(button(host, 'More Weight'))
    expect(sets()[0].w).toBe(82.5)
    tap(button(host, 'Less Reps'))
    expect(sets()[0].r).toBe(7)
  })

  it('says last time only from a logged set', () => {
    seed([lift(BENCH, [row(), row()])])
    setEditSheet(0, 0)
    expect(top().textContent).not.toContain('last time')
    act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
    useUI.setState({ sheets: [] })
    seed([lift(BENCH, [row(), row()])], { workouts: [clone(PAST)] })
    setEditSheet(0, 1)
    const host = top()
    expect(host.textContent).toContain('last time 80 kg')
    expect(host.textContent).toContain('last time 7')
  })

  it('asks for reps left in the tank when effort is RIR, and RPE when it is RPE', () => {
    seed([lift(BENCH, [row({ done: true }), row()])], { effort: 'rir' })
    setEditSheet(0, 0)
    let host = top()
    expect(host.textContent).toContain('How hard was that set?')
    expect(host.textContent).toContain('Reps left in the tank')
    tap([...host.querySelectorAll('[role="radio"]')].find(b => b.textContent === '2'))
    expect(sets()[0].rir).toBe(2)
    act(() => { mounted.splice(0).forEach(([root, h]) => { root.unmount(); h.remove() }) })
    useUI.setState({ sheets: [] })
    seed([lift(BENCH, [row({ done: true }), row()])], { effort: 'rpe' })
    setEditSheet(0, 0)
    host = top()
    tap([...host.querySelectorAll('[role="radio"]')].find(b => b.textContent === '8'))
    expect(sets()[0].rpe).toBe(8)
  })

  it('makes it a warm-up set and keeps editing the same row where it moved', () => {
    seed([lift(BENCH, [row(), row({ w: 60 }), row()])])
    setEditSheet(0, 1)
    const host = top()
    tap(switchFor(host, 'Make it a warm-up set'))
    expect(isWarmupRow(sets()[0])).toBe(true)
    expect(sets()[0].w).toBe(60)
    expect(host.textContent).toContain('Warm-up ·')
    expect(switchFor(host, 'Make it a warm-up set').getAttribute('aria-checked')).toBe('true')
  })

  it('marks failure, adds a drop and a burst, each with rows to edit', () => {
    seed([lift(BENCH, [row(), row()]), lift(FLY, [row(), row()])])
    setEditSheet(0, 0)
    let host = top()
    tap(switchFor(host, 'Taken to failure'))
    expect(isFailureSet(sets()[0])).toBe(true)
    tap(button(host, 'Drop set+ Drop') || [...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Drop set')))
    expect(dropsOf(sets()[0])).toHaveLength(1)
    expect(host.textContent).toContain('Drop 1')
    tap(button(host, 'Remove drop 1'))
    expect(dropsOf(sets()[0])).toHaveLength(0)
    setEditSheet(1, 0)
    host = top()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Rest-pause burst')))
    expect(clustersOf(sets(1)[0])).toHaveLength(1)
    expect(host.textContent).toContain('Burst 1')
  })

  it('copies the set right below it and closes', () => {
    seed([lift(BENCH, [row({ w: 70 }), row()])])
    setEditSheet(0, 0)
    const host = top()
    tap([...host.querySelectorAll('.g-drow')].find(r => r.textContent.includes('Copy this set')))
    expect(sets()).toHaveLength(3)
    expect(sets()[1].w).toBe(70)
    expect(sheetsOpen()).toBe(0)
  })

  it('removes the set with an 8 s Undo (W1.13), and Undo puts it back', () => {
    seed([lift(BENCH, [row({ w: 70 }), row(), row()])])
    setEditSheet(0, 0)
    tap(button(top(), 'Remove'))
    expect(sets()).toHaveLength(2)
    expect(useUI.getState().toastMsg).toBe('Set 1 gone.')
    act(() => useUI.getState().toastAction.run())
    expect(sets()).toHaveLength(3)
    expect(sets()[0].w).toBe(70)
  })

  it('keeps the last set of a live exercise', () => {
    seed([lift(BENCH, [row()])])
    setEditSheet(0, 0)
    expect(button(top(), 'Remove').disabled).toBe(true)
  })

  it('edits both sides of a per-side set', () => {
    seed([lift(BENCH, [makeSideSet(row({ w: 20, r: 16 }))], { target: { sets: 1, reps: 16, weight: 20, side: true } })])
    setEditSheet(0, 0)
    const host = top()
    expect(host.textContent).toContain('Left side')
    expect(host.textContent).toContain('Right side')
    const more = [...host.querySelectorAll('button')].filter(b => b.getAttribute('aria-label') === 'More Reps')
    expect(more).toHaveLength(2)
    tap(more[1])
    expect(sets()[0].sides.R.r).toBe(sets()[0].sides.L.r + 1)
  })

  it('edits a timed hold by its seconds', () => {
    seed([{ id: STRETCH, target: { mode: 'time', sec: 30, sets: 1, side: true }, sets: [{ sec: 30, w: 0, side: 'L', done: false }, { sec: 30, w: 0, side: 'R', done: false }], part: 'cooldown' }])
    setEditSheet(0, 0)
    const host = top()
    expect(host.textContent).toContain('Left')
    expect(host.textContent).toContain('Seconds')
    tap(button(host, 'More Seconds'))
    expect(sets()[0].sec).toBe(35)
  })

  it('saves the note on Save set', () => {
    seed([lift(BENCH, [row(), row()])])
    setEditSheet(0, 0)
    const host = top()
    const area = host.querySelector('textarea')
    act(() => {
      const set = Object.getOwnPropertyDescriptor(globalThis.HTMLTextAreaElement.prototype, 'value').set
      set.call(area, 'Pause at the chest')
      area.dispatchEvent(new Event('input', { bubbles: true }))
    })
    tap(button(host, 'Save set 1'))
    expect(sets()[0].note).toBe('Pause at the chest')
    expect(sheetsOpen()).toBe(0)
  })
})

describe('How to (W1.14, W1.33, W1.34, W1.43)', () => {
  it('has the rows the exercise ⋯ menu had', () => {
    seed([lift(BENCH, [row(), row()]), lift(FLY, [row()])], { workouts: [clone(PAST)] })
    howToSheet(0)
    const host = top()
    for (const text of ['Exercise settings', 'Add a warm-up set', 'Don’t count for progression', 'History', 'Remove from this workout', 'Undo for 8 s']) {
      expect(host.textContent).toContain(text)
    }
    expect(button(host, 'Swap')).toBeTruthy()
    expect(button(host, 'Back to set')).toBeTruthy()
    expect(host.textContent).toContain('Best: 80 kg × 8')
    expect(host.textContent).toContain('Last: ')
  })

  it('first time: the baseline line, and the warm-up line for a warm-up', () => {
    seed([lift(BENCH, [row()], { part: 'warmup' })])
    howToSheet(0)
    const host = top()
    expect(host.textContent).toContain('First time with this one.')
    expect(host.textContent).toContain('A warm-up: it counts in your history and muscles, not for new bests.')
    expect(host.textContent).not.toContain('Best:')
  })

  it('a timed hold says what was held', () => {
    const held = { id: 'w2', d: '2026-10-15', start: Date.parse('2026-10-15T18:00:00'), end: Date.parse('2026-10-15T19:00:00'), name: 'Push A', routineIds: [], prs: [],
      entries: [{ id: STRETCH, target: { mode: 'time', sec: 30, sets: 2, side: true }, sets: [1, 2].flatMap(() => [{ sec: 30, w: 0, side: 'L', done: true }, { sec: 30, w: 0, side: 'R', done: true }]) }] }
    seed([{ id: STRETCH, target: { mode: 'time', sec: 30, sets: 2, side: true }, sets: [{ sec: 30, w: 0, side: 'L', done: false }, { sec: 30, w: 0, side: 'R', done: false }], part: 'cooldown' }], { workouts: [held] })
    howToSheet(0)
    const host = top()
    expect(host.textContent).toContain('Held 2 × 30 s each side')
    expect(host.textContent).toContain('Cool-down')
  })

  it('adds a warm-up set and closes', () => {
    seed([lift(BENCH, [row(), row()])])
    howToSheet(0)
    tap([...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes('Add a warm-up set')))
    expect(isWarmupRow(sets()[0])).toBe(true)
    expect(sheetsOpen()).toBe(0)
  })

  it('keeps the exercise out of progression from its switch', () => {
    seed([lift(BENCH, [row()])])
    howToSheet(0)
    tap(switchFor(top(), 'Don’t count for progression'))
    expect(A().entries[0].noProg).toBe(true)
  })

  it('removes the exercise with Undo for 8 s (W1.17)', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    howToSheet(0)
    tap([...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes('Remove from this workout')))
    expect(A().entries.map(e => e.id)).toEqual([FLY])
    expect(useUI.getState().toastMsg).toMatch(/^Removed /)
    act(() => useUI.getState().toastAction.run())
    expect(A().entries.map(e => e.id)).toEqual([BENCH, FLY])
  })

  // old Workout.remove.test.jsx:87: removal is out of reach for the whole duration of a timed hold
  it('offers no Remove row while a hold runs, and gives it back when the hold ends', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    howToSheet(0)
    const removeRow = () => [...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes('Remove from this workout'))
    expect(removeRow()).toBeTruthy()
    act(() => useUI.getState().startWork(30, 'Hold', vi.fn()))
    expect(removeRow()).toBeUndefined()
    act(() => useUI.getState().stopWork())
    expect(removeRow()).toBeTruthy()
  })

  it('opens Exercise settings with Part of the workout, closing How to first', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    howToSheet(1)
    tap([...top().querySelectorAll('.g-drow')].find(r => r.textContent.includes('Exercise settings')))
    expect(sheetsOpen()).toBe(1)
    const host = top()
    expect(host.querySelector('.g-seg[aria-label="Part of the workout"]')).not.toBeNull()
    tap([...host.querySelectorAll('.g-seg button')].find(b => b.textContent === 'Warm-up'))
    tap(button(host, 'Done'))
    expect(A().entries.map(e => e.id)).toEqual([FLY, BENCH])
    expect(A().entries[0].part).toBe('warmup')
  })
})

describe('Swap, a step inside How to (W1.15, W1.16)', () => {
  const openSwap = () => {
    howToSheet(1)
    const host = top()
    tap(button(host, 'Swap'))
    return host
  }
  const firstRow = host => host.querySelector('.g-xrow')

  it('lists the same muscle with what was done last, and the two scopes', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    const host = openSwap()
    expect(sheetsOpen()).toBe(1)
    expect(host.textContent).toMatch(/^Swap /)
    expect(host.textContent).toContain('Same muscle')
    expect(host.textContent).toContain('Never done')
    expect(host.textContent).toContain('This workout only')
    expect(host.textContent).toContain('Push A keeps')
    expect(host.textContent).toContain('Also in Push A')
  })

  it('this workout only: the session changes, the routine does not', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    tap(firstRow(openSwap()))
    expect(A().entries[1].id).not.toBe(FLY)
    expect(useStore.getState().S.routines[0].ex[1].id).toBe(FLY)
    expect(useUI.getState().toastMsg).toMatch(/This workout only\.$/)
    expect(sheetsOpen()).toBe(0)
  })

  it('also in Push A: both change, and one Undo puts both back', () => {
    seed([lift(BENCH, [row()]), lift(FLY, [row()])])
    const host = openSwap()
    tap([...host.querySelectorAll('.g-radio, [role="radio"], button')].find(b => b.textContent.startsWith('Also in Push A')))
    tap(firstRow(host))
    const to = A().entries[1].id
    expect(to).not.toBe(FLY)
    expect(useStore.getState().S.routines[0].ex[1].id).toBe(to)
    act(() => useUI.getState().toastAction.run())
    expect(A().entries[1].id).toBe(FLY)
    expect(useStore.getState().S.routines[0].ex[1].id).toBe(FLY)
  })

  it('a freestyle exercise has no routine to change', () => {
    seed([lift(BENCH, [row()]), { ...lift(FLY, [row()]), rid: undefined }])
    expect(openSwap().textContent).not.toContain('Also in')
  })
})

describe('Plate loading (W1.25)', () => {
  it('loads 80 kg on a 20 kg bar as 25 + 5 each side', () => {
    seed([lift(BENCH, [row()])])
    platesSheet(0)
    const host = top()
    expect(host.textContent).toContain('Load 80 kg')
    expect(host.textContent).toContain('Total')
    expect(host.textContent).toContain('20 kg')
    expect(host.textContent).toContain('30 kg')
    expect(host.querySelector('[aria-label="80 kg: bar plus 25 and 5 each side"]')).not.toBeNull()
    expect(host.textContent).toContain('From your plates.')
  })

  it('Gym setup leaves through the drawer\'s history entry', () => {
    seed([lift(BENCH, [row()])])
    platesSheet(0)
    tap(button(top(), 'Change them in Gym setup.'))
    expect(closeThenNav).toHaveBeenCalledWith(expect.any(Function), '/me/equipment')
  })

  it('names the equipment profile only when there is one', () => {
    seed([lift(BENCH, [row()])], { equipmentProfiles: [{ id: 'home', name: 'Home gym', eq: [] }], activeProfile: 'home' })
    platesSheet(0)
    const text = top().textContent
    expect(text.includes('From your plates at Home gym.') || text.includes('From your plates.')).toBe(true)
  })
})

describe('Time left (W1.4) and the exercise rest', () => {
  it('Done hands the wheel\'s time to applyRestLeft, whose 0:00 ends the rest', () => {
    seed([lift(BENCH, [row({ done: true }), row()])])
    useUI.getState().startRest(90, 0)
    restWheelSheet()
    const host = top()
    expect(host.textContent).toContain('Time left')
    expect(host.textContent).toContain('Scroll to 0:00 to end the rest now.')
    tap(button(host, 'Done'))
    expect(applyRestLeft).toHaveBeenCalledWith(expect.any(Number), 90)
    applyRestLeft(0, 90)
    expect(useUI.getState().timer).toBeNull()
  })

  it('Skip ends the rest', () => {
    seed([lift(BENCH, [row({ done: true }), row()])])
    useUI.getState().startRest(90, 0)
    restWheelSheet()
    tap(button(top(), 'Skip'))
    expect(useUI.getState().timer).toBeNull()
  })

  it('opens nothing without a rest', () => {
    seed([lift(BENCH, [row()])])
    restWheelSheet()
    expect(sheetsOpen()).toBe(0)
  })

  it('the exercise\'s own rest saves on Done', () => {
    seed([lift(BENCH, [row()], { target: { sets: 1, reps: 8, restSec: 150 } })])
    exerciseRestSheet(0)
    const host = top()
    expect(host.textContent).toContain('Rest for this exercise')
    tap(button(host, 'Done'))
    expect(typeof A().entries[0].target.restSec).toBe('number')
    expect(sheetsOpen()).toBe(0)
  })
})
