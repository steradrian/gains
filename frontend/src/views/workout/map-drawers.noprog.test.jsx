// @vitest-environment happy-dom
// "Don't count for progression" for the whole workout, from Workout options (guard-M2a), ported from
// Workout.noprog-session.test.jsx: every exercise gets the marker, it switches off again, what joins
// the session later follows it, and the saved-workout editor opens, changes and saves it. The old
// header ⋮ and the cards' `.noprog` marker are gone; the switch lives in map-drawers.jsx and the
// state is read from the store. The marker on the card itself: see the it.todo at the end.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { setNav } from '../../lib/nav.js'
import { editCompletedSession } from '../../lib/session-edit.js'
import { lastEntryFor } from '../../lib/history.js'
import { addExerciseSheet, workoutOptionsSheet } from './drawers.js'
import { setNoProgAt } from './workout-actions.js'
import { progressionOf } from './workout-view.js'
import { finishSheet } from './finish-drawers.js'
import { addRoutineToSessionSheet } from '../../sheets.jsx'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'
const ROW = '0027'
const SQUAT = '0043'
const routines = [
  { id: 'main', name: 'Main', ex: [{ id: BENCH, sets: 1, reps: 5, weight: 100 }, { id: ROW, sets: 1, reps: 8, weight: 60 }] },
  { id: 'legs', name: 'Legs', ex: [{ id: SQUAT, sets: 1, reps: 5, weight: 80 }] },
  { id: 'deload', name: 'Deload', excludeFromProgression: true, ex: [{ id: ROW, sets: 1, reps: 8, weight: 40 }] },
]
const entry = (id, rid, w, extra = {}) => ({ id, rid, target: { sets: 1, reps: 5, weight: w }, sets: [{ w, r: 5, done: false }], ...extra })
const LABEL = 'Don’t count for progression'

function seed(entries, { workouts = [] } = {}) {
  const S = clone(DEF)
  S.routines = clone(routines)
  S.workouts = clone(workouts)
  S.active = { id: 'session', d: '2026-09-24', start: Date.now(), routineIds: ['main'], routineId: 'main', name: 'Main', bw: null, cur: 0, entries: clone(entries) }
  useStore.setState({ S, user: null })
}
function seedEditor(saved, extra = []) {
  const S = clone(DEF)
  S.routines = clone(routines)
  S.workouts = [clone(saved), ...clone(extra)]
  editCompletedSession(S, saved.id)
  useStore.setState({ S, user: null })
}
const A = () => useStore.getState().S.active
const mounted = []
function top() {
  const sheet = useUI.getState().sheets.at(-1)
  expect(sheet).toBeTruthy()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const tap = el => { expect(el).toBeTruthy(); act(() => el.click()) }
const switchOf = host => [...host.querySelectorAll('.g-switchrow')].find(r => r.textContent.includes(LABEL))?.querySelector('[role="switch"]')
const isOn = sw => sw.getAttribute('aria-checked') === 'true'
/** Opens Workout options and returns the host with its switch (undefined when it is not offered). */
const openOptions = () => {
  workoutOptionsSheet()
  const host = top()
  return { host, sw: switchOf(host) }
}
const toggleSession = () => {
  const { sw } = openOptions()
  tap(sw)
  useUI.getState().closeAll()
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
  setNav(() => {})
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useUI.getState().closeAll()
  useStore.setState({ S: clone(DEF) })
})

describe('don’t count the whole workout for progression', () => {
  it('the switch keeps every exercise out, and a second tap counts them again', () => {
    seed([entry(BENCH, 'main', 100), entry(ROW, 'main', 60)])
    const { sw } = openOptions()
    expect(sw).toBeTruthy()
    expect(isOn(sw)).toBe(false)
    tap(sw)

    expect(A().noProg).toBe(true)
    expect(A().entries.map(e => e.noProg)).toEqual([true, true])
    // The routine is not touched.
    expect(useStore.getState().S.routines.find(r => r.id === 'main').excludeFromProgression).toBeUndefined()
    expect(isOn(sw)).toBe(true)

    tap(sw)
    expect(A().noProg).toBeUndefined()
    expect(A().entries.map(e => e.noProg)).toEqual([undefined, undefined])
  })

  it('switched off, an exercise a deload routine keeps out stays out', () => {
    seed([entry(BENCH, 'main', 100), entry(ROW, 'deload', 40, { noProg: true })])
    const { sw } = openOptions()
    tap(sw)
    tap(sw)
    expect(A().entries.map(e => e.noProg)).toEqual([undefined, true])
  })

  it('is not offered when a deload routine already keeps every exercise out', () => {
    seed([entry(ROW, 'deload', 40, { noProg: true })])
    expect(openOptions().sw).toBeUndefined()
  })

  it('counting one exercise again (its How to switch, or the marker’s old Undo) ends the whole-workout state', () => {
    seed([entry(BENCH, 'main', 100), entry(ROW, 'main', 60)])
    toggleSession()
    setNoProgAt(1, false)
    expect(A().entries.map(e => e.noProg)).toEqual([true, undefined])
    expect(A().noProg).toBeUndefined()
    expect(isOn(openOptions().sw)).toBe(false)
  })

  it('an exercise added afterwards joins it', () => {
    seed([entry(BENCH, 'main', 100)])
    toggleSession()
    addExerciseSheet()
    tap(top().querySelector('.g-pk-add'))
    expect(A().entries).toHaveLength(2)
    expect(A().entries.map(e => e.noProg)).toEqual([true, true])
  })

  it('a routine added afterwards joins it, with its own prescription kept', () => {
    seed([entry(BENCH, 'main', 100)])
    toggleSession()
    addRoutineToSessionSheet()
    const legs = [...top().querySelectorAll('.item')].find(it => it.textContent.includes('Legs'))
    tap(legs)
    const squat = A().entries.find(e => e.id === SQUAT)
    expect(squat.noProg).toBe(true)
    expect(squat.plan?.kind).not.toBe('off')
  })

  it('without it, an exercise kept out on its own is not passed on to one added after it', () => {
    seed([entry(BENCH, 'main', 100, { noProg: true })])
    expect(isOn(openOptions().sw)).toBe(false)
    useUI.getState().closeAll()
    addExerciseSheet()
    tap(top().querySelector('.g-pk-add'))
    expect(A().entries).toHaveLength(2)
    expect(A().entries[1].noProg).toBeUndefined()
  })
})

// The #203 editor is the same screen on a copy of the saved workout.
describe('the whole-workout switch in the saved-workout editor', () => {
  const done = (id, w) => ({ id, rid: 'main', target: { sets: 1, reps: 5, weight: w }, sets: [{ w, r: 5, done: true }] })
  const counting = { id: 'saved', d: '2026-09-22', start: 1000, end: 2000, routineIds: ['main'], name: 'Main', entries: [done(BENCH, 100), done(ROW, 60)] }
  const excluded = { ...counting, excludeFromProgression: true, entries: counting.entries.map(e => ({ ...e, noProg: true })) }
  const earlier = { id: 'earlier', d: '2026-09-20', start: 0, end: 1, routineIds: ['main'], name: 'Main', entries: [done(BENCH, 90)] }
  const saved = () => useStore.getState().S.workouts.find(w => w.id === 'saved')

  it('a workout kept out as a whole opens with the switch on; switched off and saved, it counts again', () => {
    seedEditor(excluded)
    expect(A().editingWorkoutId).toBe('saved')
    const { sw } = openOptions()
    expect(isOn(sw)).toBe(true)
    tap(sw)
    useUI.getState().closeAll()
    act(() => finishSheet())

    expect(A()).toBeNull()
    expect(saved()).not.toHaveProperty('excludeFromProgression')
    expect(saved().entries.some(e => 'noProg' in e)).toBe(false)
    expect(lastEntryFor(useStore.getState().S, BENCH, 'main').d).toBe('2026-09-22')
  })

  it('switched on in the editor and saved, the workout is kept out like one finished that way', () => {
    seedEditor(counting, [earlier])
    toggleSession()
    expect(A().entries.every(e => e.noProg === true)).toBe(true)
    act(() => finishSheet())

    expect(saved().excludeFromProgression).toBe(true)
    expect(saved().entries.every(e => e.noProg === true)).toBe(true)
    expect(saved()).not.toHaveProperty('noProg')
    expect(lastEntryFor(useStore.getState().S, BENCH, 'main').d).toBe('2026-09-20')
  })
})

describe('what the old cards showed', () => {
  // The marker is W1.50 and W1.51's dashed line: the exercise's own, or "the whole workout is left out"
  // with an Undo that counts it again; a deload routine's exercise shows it with no button.
  it('every kept-out exercise shows the not-counted line, the session\'s own says the whole workout, a deload routine\'s has no Undo', () => {
    seed([entry(BENCH, 'main', 100), entry(ROW, 'deload', 40, { noProg: true })])
    const S = () => useStore.getState().S
    expect(progressionOf(S(), A(), A().entries[0])).toBeNull()
    expect(progressionOf(S(), A(), A().entries[1])).toMatchObject({ type: 'skipped', scope: 'exercise', text: 'Not counted for progression today', undoable: false })
    act(() => setNoProgAt(0, true))
    expect(progressionOf(S(), A(), A().entries[0])).toMatchObject({ type: 'skipped', scope: 'exercise', undoable: true, undoLabel: 'Undo, count it again' })
    act(() => setNoProgAt(0, false))
    toggleSession()
    expect(progressionOf(S(), A(), A().entries[0])).toMatchObject({ type: 'skipped', scope: 'session', text: 'The whole workout is left out of progression', undoable: true })
  })
})
