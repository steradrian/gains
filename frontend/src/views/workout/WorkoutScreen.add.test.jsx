// @vitest-environment happy-dom
// Add exercise and the discard timer lifecycle on the running workout (guard-M1), ported from
// Workout.test.jsx:542-640 and :832-866. The hook's `addExercise` goes through the real drawers.js
// `addExerciseSheet`, with the picker and the config sheet mocked as the old tests did; the
// discard goes through the real `discardSheet` drawer.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { exConfigSheet, exercisePicker, workoutCompleteSheet } from '../../sheets.jsx'
import { popToRoot } from '../../lib/use-tab-nav.js'
import { discardSheet } from './finish-drawers.js'
import { resetBested, useWorkout } from './use-workout.js'
import { active, exercise, lift, mountHook, resetTimers, seed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/', IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../../lib/use-tab-nav.js', async importOriginal => ({ ...(await importOriginal()), popToRoot: vi.fn(), back: vi.fn() }))
vi.mock('../../sheets.jsx', async importOriginal => ({
  ...(await importOriginal()), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), workoutCompleteSheet: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const BENCH = '0025'
const SITUP = '0001'
let hook
const actions = () => hook.out.current.actions

/** Add exercise → pick `ex` → confirm `cfg`, the way the sheets call back. Returns the config sheet's arguments. */
function addThroughSheets(ex = { id: SITUP }, cfg = { mode: 'reps', sets: 1, reps: 5, weight: 0 }) {
  act(() => actions().addExercise())
  expect(exercisePicker).toHaveBeenCalledTimes(1)
  act(() => { exercisePicker.mock.calls.at(-1)[0](ex) })
  const config = exConfigSheet.mock.calls.at(-1)
  expect(config?.[2]).toEqual(expect.any(Function))
  act(() => { config[2](cfg) })
  return config
}

function start(entries, opts) {
  seed(entries, opts)
  hook = mountHook(useWorkout)
  return hook
}

beforeEach(() => { vi.useFakeTimers(); resetBested() })
afterEach(() => {
  hook?.unmount()
  hook = null
  resetTimers()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('add exercise', () => {
  it.each([
    ['freestyle', {}, undefined],
    ['planned', { routines: [{ id: 'routine-1', ex: [] }] }, 'routine-1'],
  ])('inserts after the current unit and leaves the inserted exercise selected after completion in a %s session', (_label, state, rid) => {
    const own = extra => (rid ? { ...extra, rid } : extra)
    start([exercise(BENCH, [true], own({})), exercise('0426', [false], own({}))], { ...state, autoNext: false })

    addThroughSheets({ id: SITUP }, { mode: 'time', sets: 1, sec: 30, weight: 0 })
    expect(active().entries.map(e => e.id)).toEqual([BENCH, SITUP, '0426'])
    expect(active().cur).toBe(1)

    act(() => actions().toggle(1, 0))
    expect(active().entries[1].sets[0].done).toBe(true)
    expect(active().cur).toBe(1)
    expect(workoutCompleteSheet).not.toHaveBeenCalled()
  })

  it('inserts after the complete current superset without splitting the group, and the confirm says "Add to this workout"', () => {
    start([
      exercise(BENCH, [true], { sg: 'current-group' }),
      exercise('0426', [true], { sg: 'current-group' }),
      exercise('0334', [false]),
    ])
    const config = addThroughSheets({ id: SITUP })
    expect(active().entries.map(e => e.id)).toEqual([BENCH, '0426', SITUP, '0334'])
    expect(active().entries.slice(0, 2).map(e => e.sg)).toEqual(['current-group', 'current-group'])
    expect(active().cur).toBe(2)
    expect(config[7]).toBe('Add to this workout')
  })

  it('adds after the exercise `afterIdx` names, into the part given', () => {
    start([exercise(BENCH, [false]), exercise('0426', [false])])
    act(() => actions().addExercise({ afterIdx: 0 }))
    act(() => { exercisePicker.mock.calls.at(-1)[0]({ id: SITUP }) })
    act(() => { exConfigSheet.mock.calls.at(-1)[2]({ mode: 'reps', sets: 1, reps: 5, weight: 0 }) })
    expect(active().entries.map(e => e.id)).toEqual([BENCH, SITUP, '0426'])
  })
})

// An exercise added to the block of a routine kept out of progression (a rehab or deload routine)
// belongs to that block: its routine's own numbers, and no count toward progression.
describe('adding an exercise to a block kept out of progression', () => {
  const history = [{
    id: 'h1', d: '2026-08-27', routineIds: ['main'],
    entries: [{ id: BENCH, rid: 'main', target: { sets: 1, reps: 5, weight: 100 }, sets: [{ w: 100, r: 5, done: true }] }],
  }]
  const routines = [{ id: 'rehab', name: 'Rehab', excludeFromProgression: true, ex: [] }, { id: 'main', name: 'Main', ex: [] }]
  const addBench = () => addThroughSheets({ id: BENCH }, { mode: 'reps', sets: 1, reps: 5, weight: 40 })

  it('is kept out too, at the numbers typed for it', () => {
    start([exercise('0426', [false], { rid: 'rehab', noProg: true })], { routines, workouts: history })
    addThroughSheets({ id: BENCH }, { mode: 'reps', sets: 1, reps: 12, weight: 40 })
    const added = active().entries[1]
    expect(added).toMatchObject({ id: BENCH, rid: 'rehab', noProg: true })
    expect(added.plan.kind).toBe('off')
    expect(added.sets.map(s => [s.w, s.r])).toEqual([[40, 12]])
  })

  it('still progresses when the block is a regular routine\'s', () => {
    start([exercise('0426', [false], { rid: 'main' })], { routines, workouts: history })
    addBench()
    const added = active().entries[1]
    expect(added.noProg).toBeUndefined()
    expect(added.plan.kind).toBe('up')
    expect(added.sets.map(s => s.w)).toEqual([102.5])
  })

  // #284 review: an exercise added to a workout logged into the past is built from what came
  // before that day, not from a session logged after it.
  it('builds an exercise added to a workout logged into the past from the history before its day', () => {
    const later = [...history, {
      id: 'h2', d: '2026-08-31', routineIds: ['main'],
      entries: [{ id: BENCH, rid: 'main', target: { sets: 1, reps: 5, weight: 102.5 }, sets: [{ w: 102.5, r: 5, done: true }] }],
    }]
    const past = { d: '2026-08-29', start: Date.parse('2026-08-29T18:00:00'), backfill: { durationMin: 60, replaceId: null } }
    start([exercise('0426', [false], { rid: 'main' })], { routines, workouts: later, active: past })
    addBench()
    expect(active().entries[1].sets.map(s => s.w)).toEqual([102.5])
  })

  it('does not pass on an exercise kept out by hand for today', () => {
    start([exercise('0426', [false], { rid: 'main', noProg: true })], { routines, workouts: history })
    addBench()
    const added = active().entries[1]
    expect(added.noProg).toBeUndefined()
    expect(added.plan.kind).toBe('up')
    expect(added.sets.map(s => s.w)).toEqual([102.5])
  })
})

describe('discard timer lifecycle', () => {
  const logged = () => [lift(BENCH, 80, 8, 2, { sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: false }] })]
  let drawer
  function openDiscard() {
    discardSheet()
    const sheet = useUI.getState().sheets.at(-1)
    expect(sheet, 'the discard drawer').toBeTruthy()
    const host = document.createElement('div')
    document.body.appendChild(host)
    drawer = createRoot(host)
    act(() => drawer.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    return host
  }
  const confirm = host => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Discard workout')
    expect(button).toBeTruthy()
    act(() => button.click())
  }
  afterEach(() => { act(() => drawer?.unmount()); drawer = null })

  it('preserves an active rest while discard is awaiting confirmation', () => {
    start(logged())
    act(() => useUI.getState().startRest(90, 0))
    const timer = useUI.getState().timer
    openDiscard()
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().timer).toBe(timer)
    expect(active()).not.toBeNull()
  })

  it('preserves an active hold while discard is awaiting confirmation', () => {
    start(logged())
    act(() => useUI.getState().startWork(45, 'Plank', () => {}, { idx: 0, i: 1, id: BENCH }))
    const work = useUI.getState().work
    openDiscard()
    expect(useUI.getState().work).toBe(work)
    expect(active()).not.toBeNull()
  })

  it('clears rest only after discard is confirmed', () => {
    start(logged())
    act(() => useUI.getState().startRest(90, 0))
    confirm(openDiscard())
    expect(active()).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    expect(popToRoot).toHaveBeenCalledWith('home')
  })

  it('clears the hold only after discard is confirmed', () => {
    start(logged())
    act(() => useUI.getState().startWork(45, 'Plank', () => {}, { idx: 0, i: 1, id: BENCH }))
    confirm(openDiscard())
    expect(active()).toBeNull()
    expect(useUI.getState().work).toBeNull()
  })
})
