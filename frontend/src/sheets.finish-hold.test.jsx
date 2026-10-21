// @vitest-environment happy-dom
// Finishing a workout while a timed hold counts down. Discard has stopped the hold since GL!59;
// Finish stopped only the rest timer, so the hold bar (app-wide, App.jsx) went on counting over
// the summary and Home, chimed at zero, and its callback then wrote into a workout that was gone.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout, finishWorkoutSheet, finishAndSave, beginWorkout, openReady } from './sheets.jsx'
import { EXDB } from './lib/exercises-data.js'
import { setNav } from './lib/nav.js'
import { reopenWorkout } from './lib/workout-reopen.js'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

// Mounted before the click's own act(): a render nested inside it lands only once it is over.
function tapInTopSheet(text) {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  const target = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}

function install(sets) {
  const st = clone(DEF)
  st.active = {
    id: 'fin', d: '2026-09-28', start: Date.now() - 20 * 60000, routineId: null, name: 'Core', bw: null, cur: 0,
    entries: [{ id: EXDB[0].id, target: { mode: 'reps', sets: sets.length, reps: 5, weight: 40 }, sets }]
  }
  useStore.setState({ S: st, user: null })
}

// Shaped like the row's own callback in views/Workout.jsx: it writes what was held into the set.
const holdInto = set => vi.fn(elapsed => useStore.getState().update(s => { s.active.entries[0].sets[set].sec = elapsed }))

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => {
  mounted.splice(0).forEach(r => act(() => r.unmount()))
  document.body.innerHTML = ''
  useUI.getState().stopWork()
  vi.useRealTimers()
})

describe('finishing while a timed hold runs', () => {
  it('stops the hold, which then never calls back into the finished workout', () => {
    install([{ w: 40, r: 5, done: true }])
    const held = holdInto(0)
    useUI.getState().startWork(45, 'Plank', held)

    act(() => finishWorkout())

    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
    expect(useUI.getState().work).toBeNull()
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(held).not.toHaveBeenCalled()
  })

  it('stops it too when the hold is the set left unchecked and Finish early is confirmed', () => {
    install([{ w: 40, r: 5, done: true }, { w: 40, r: 5 }])
    const held = holdInto(1)
    useUI.getState().startWork(45, 'Plank', held)

    act(() => finishWorkout())
    tapInTopSheet('Finish workout')

    expect(S().active).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(held).not.toHaveBeenCalled()
  })
})

// The header's Finish pill (v1.3.11): a sheet with Finish and save and Discard workout, the
// unchecked-sets warning as its subtitle, and no second question after Finish and save.
describe('the Finish sheet', () => {
  const sheetText = () => {
    const sheet = useUI.getState().sheets.at(-1)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    mounted.push(root)
    act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    return host
  }
  const tapItem = (host, text) => act(() => { [...host.querySelectorAll('.menu-item')].find(el => el.textContent.includes(text)).click() })

  it('all sets done: Finish workout? and a save that needs no confirm', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkoutSheet({ onDiscard: vi.fn() }))
    const host = sheetText()
    expect(host.querySelector('h3').textContent).toBe('Finish workout?')
    expect([...host.querySelectorAll('.menu-item .tt')].map(e => e.textContent)).toEqual(['Finish and save', 'Discard workout'])
    expect(host.querySelector('.menu-item.danger').textContent).toContain('Discard workout')
    tapItem(host, 'Finish and save')
    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
  })

  it('keeps the early-finish wording as its message, and Discard calls the screen\'s own discard', () => {
    install([{ w: 40, r: 5, done: true }, { w: 40, r: 5 }, { w: 40, r: 5 }])
    const onDiscard = vi.fn()
    act(() => finishWorkoutSheet({ onDiscard }))
    const host = sheetText()
    expect(host.querySelector('h3').textContent).toBe('Finish early?')
    expect(host.textContent).toContain('2 sets still unchecked. Finish the workout now?')
    tapItem(host, 'Discard workout')
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(S().active).not.toBeNull()
  })

  it('nothing checked: says so', () => {
    install([{ w: 40, r: 5 }])
    act(() => finishWorkoutSheet({ onDiscard: vi.fn() }))
    const host = sheetText()
    expect(host.querySelector('h3').textContent).toBe('Nothing logged yet')
    expect(host.textContent).toContain('You haven’t checked off any sets.')
  })
})

// Workout finish M1: doFinishWorkout is finishAndSave plus the old summary sheet, so nothing the
// user sees changes; finishAndSave alone saves and hands back what Reopen needs.
describe('doFinishWorkout and finishAndSave', () => {
  const ID = EXDB[0].id

  it('Finish still saves, confirms the weight, marks the best and opens the locked summary', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkout())
    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
    expect(S().workouts[0].prs).toEqual([ID])
    expect(S().exWeights[ID]).toEqual({ w: 40, d: '2026-09-28' })
    const sheet = useUI.getState().sheets.at(-1)
    expect(sheet).toMatchObject({ kind: 'center', locked: true })
  })

  it('finishAndSave saves without a sheet and returns the record, the bests and the snapshot', () => {
    install([{ w: 40, r: 5, done: true }])
    let saved
    act(() => { saved = finishAndSave() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(saved.w).toBe(S().workouts[0])
    expect(saved.prs).toEqual([ID])
    expect(saved.e1prs).toEqual([])
    expect(saved.snapshot).toMatchObject({ workoutId: 'fin', exWeights: { [ID]: null }, rotation: null })
    expect(saved.snapshot.active.entries[0].sets[0]).toMatchObject({ w: 40, r: 5, done: true })
    expect(useUI.getState().work).toBeNull()
  })

  it('a warm-up exercise is never a best and never sets the weight', () => {
    install([{ w: 40, r: 5, done: true }])
    useStore.getState().update(s => { s.active.entries[0].part = 'warmup' })
    let saved
    act(() => { saved = finishAndSave() })
    expect(saved.prs).toEqual([])
    expect(S().exWeights[ID]).toBeUndefined()
    expect(saved.snapshot.exWeights).toEqual({})
  })

  it('an end given ends the workout there', () => {
    install([{ w: 40, r: 5, done: true }])
    const end = S().active.start + 10 * 60000
    act(() => { finishAndSave({ end }) })
    expect(S().workouts[0].end).toBe(end)
  })

  it('nothing running: null', () => {
    useStore.setState({ S: clone(DEF), user: null })
    expect(finishAndSave()).toBeNull()
  })

  it('Reopen right after puts the session back and takes the record and the weight out', () => {
    install([{ w: 40, r: 5, done: true }])
    let saved
    act(() => { saved = finishAndSave() })
    expect(reopenWorkout(saved.snapshot)).toBe(true)
    expect(S().active.id).toBe('fin')
    expect(S().workouts).toHaveLength(0)
    expect(S().exWeights[ID]).toBeUndefined()
    expect(Number(S().deleted.workouts.fin)).toBeGreaterThan(0)
  })
})

describe('Ready and the start (finish M1)', () => {
  const routine = { id: 'r1', name: 'Push A', ex: [
    { id: EXDB[0].id, sets: 2, reps: 10, part: 'warmup' },
    { id: EXDB[1].id, sets: 3, reps: 8 },
  ] }
  const to = vi.fn()
  beforeEach(() => {
    to.mockClear()
    setNav(to)
    useStore.setState({ S: { ...clone(DEF), routines: [clone(routine)] }, user: null })
  })

  it('openReady goes to the workout route with ?start=', () => {
    openReady(['r1', 'r2'])
    expect(to).toHaveBeenCalledWith('/train/workout?start=r1,r2')
  })

  it('beginWorkout with skipWarmup starts at the first working exercise and marks the offer made', () => {
    act(() => beginWorkout(['r1'], 80, { skipWarmup: true }))
    expect(S().active).toMatchObject({ cur: 1, bw: 80, skipped: { warmup: true }, offered: { warmup: true } })
  })

  it('beginWorkout without it starts as before', () => {
    act(() => beginWorkout(['r1'], null))
    expect(S().active.cur).toBe(0)
    expect(S().active.skipped).toBeUndefined()
    expect(S().active.entries.map(e => e.id)).toEqual([EXDB[0].id, EXDB[1].id])
  })
})
