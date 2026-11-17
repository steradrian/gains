// @vitest-environment happy-dom
// Workout guard M1, the running screen's flow cases: the effort chips under the hero, a superset
// that survives a removal, the done row's spoken label. What is still an `it.todo` below names its
// old file:line; the hand-back (docs/handoffs/gains-workout-guard-m1-handback.md) maps every one
// to its new home. Todos, not skips, so the count stays visible until guard-M2 may delete the old files.
// Ported elsewhere: use-workout.test.jsx (completion flow, displaced hold, heartbeat),
// WorkoutScreen.add / .steppers / .keys / .hold / .rest .test.jsx.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../store/useUI.js'
import { removeActiveExercise, setEffortAt } from './workout-actions.js'
import { resetBested, useWorkout } from './use-workout.js'
import WorkoutScreen from './WorkoutScreen.jsx'
import { active, exercise, lift, mountHook, resetTimers, seed } from './test-fixtures.js'

vi.mock('../../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), endTone: vi.fn() }))
vi.mock('../../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/', IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const todos = (title, list) => describe(title, () => { for (const name of list) it.todo(name) })
const BENCH = '0025'
let root
let host
let hook
function renderScreen(entries, opts) {
  seed(entries, opts)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><WorkoutScreen /></MemoryRouter>))
}
const labelled = label => host.querySelector(`[aria-label="${label}"]`)
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const press = el => { expect(el).toBeTruthy(); act(() => el.click()) }
const radios = () => [...host.querySelectorAll('[role="radio"]')]
const checked = () => radios().filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.textContent)

const realStartRest = useUI.getState().startRest
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] }); resetBested() })
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  hook?.unmount()
  hook = null
  resetTimers()
  useUI.setState({ startRest: realStartRest })
  vi.clearAllMocks()
  vi.useRealTimers()
})

// A weighted exercise of `n` sets with the first `done` ticked; `rated` maps set index to its effort field.
const effortLift = (done, n, rated = {}) => ({
  ...lift(BENCH, 60, 5, n),
  sets: Array.from({ length: n }, (_, i) => ({ w: 60, r: 5, done: i < done, ...(rated[i] ?? {}) })),
})

// The old effort cell (a column of colour-coded cells, a ±0.5 stepper, a picker sheet) is the chips
// under the hero now: they ask about the set just done, on the profile's own scale. The stepper and
// the tint are dropped by design (boards W1.12/W1.38); the ±0.5 stepping stays in workout-actions
// (workout-actions.test.js 'sets and steps the effort') and the Set edit drawer has its own chips.
describe('effort chips under the hero', () => {
  it('shows them only when the profile logs a scale, and only for the set just done', () => {
    renderScreen([effortLift(1, 3)], { effort: 'none' })
    expect(radios()).toHaveLength(0)
    act(() => root.unmount())
    host.remove()
    renderScreen([effortLift(0, 3)], { effort: 'rir' })
    expect(radios()).toHaveLength(0)
    act(() => root.unmount())
    host.remove()
    renderScreen([effortLift(1, 3)], { effort: 'rir' })
    expect(radios().length).toBeGreaterThan(0)
    expect(host.textContent).toContain('How hard was set 1?')
  })

  it('asks on the profile scale: RIR offers 0 to 4+, RPE offers 6 to 10, and an unrated set has none chosen', () => {
    renderScreen([effortLift(1, 3)], { effort: 'rir' })
    expect(radios().map(r => r.textContent)).toEqual(['0 · failure', '1', '2', '3', '4+'])
    expect(checked()).toEqual([])
    act(() => root.unmount())
    host.remove()
    renderScreen([effortLift(1, 3)], { effort: 'rpe' })
    expect(radios().map(r => r.textContent)).toEqual(['6', '7', '8', '9', '10'])
  })

  it('shows a logged rating as the chosen chip', () => {
    renderScreen([effortLift(1, 3, { 0: { rir: 2 } })], { effort: 'rir' })
    expect(checked()).toEqual(['2'])
  })

  it('reads an RPE profile from the rpe field', () => {
    renderScreen([effortLift(1, 3, { 0: { rpe: 8 } })], { effort: 'rpe' })
    expect(checked()).toEqual(['8'])
  })

  it('writes the tapped chip onto the set just done', () => {
    renderScreen([effortLift(1, 3)], { effort: 'rir' })
    press(radios().find(r => r.textContent === '2'))
    expect(active().entries[0].sets[0].rir).toBe(2)
    expect(checked()).toEqual(['2'])
  })

  it('clears the rating by dropping the key, not by storing null', () => {
    renderScreen([effortLift(1, 3, { 0: { rir: 2 } })], { effort: 'rir' })
    act(() => setEffortAt(0, 0, 'rir', null))
    expect('rir' in active().entries[0].sets[0]).toBe(false)
  })
})

describe('superset flow survives an exercise being removed mid-session', () => {
  // removeActiveExercise splices A.entries, shifting every index above the removal down. The
  // high-water marks are index-keyed, so without re-baselining the shifted exercise inherits its
  // predecessor's mark and its next completed set reads as an uncheck/re-check: no advance, and no
  // rest at the end of the round.
  it('still advances and rests for sets completed after a removal', () => {
    const startRest = vi.fn(realStartRest)
    useUI.setState({ startRest })
    seed([exercise('0001', [true, true]), exercise('0334', [false, false], { sg: 'g1' }), exercise('0201', [false, false], { sg: 'g1' })], { cur: 1, autoNext: false })
    hook = mountHook(useWorkout)

    // Drop the first exercise: bench moves 1 -> 0, row moves 2 -> 1. Stale marks would be [2, 0, 0].
    act(() => removeActiveExercise(0))
    expect(active().cur).toBe(0)
    startRest.mockClear()

    // First member of the group: real progress, so the flow advances to the partner.
    act(() => hook.out.current.actions.toggle(0, 0))
    expect(active().cur).toBe(1)

    // The partner closes the round (each still has a second set), which is what starts the rest.
    act(() => hook.out.current.actions.toggle(1, 0))
    expect(startRest).toHaveBeenCalledWith(90, expect.any(Number), { forSet: expect.any(Number) })
  })
})

describe('set ticks for screen readers', () => {
  // Old: the ticks were checkboxes named "Set 1 done". A done set is a row named by what it says
  // and what it does now (DoneSetRows, label from buildWorkoutView): "1, 80 kg × 8. Edit".
  it('names each done set by its number and what was lifted, and says it opens the set to fix', () => {
    renderScreen([lift(BENCH, 80, 8, 2), lift('0426', 24, 8, 2)], { autoNext: false })
    expect(labelled('1, 80 kg × 8. Edit')).toBeNull()
    press(button('Done set'))
    expect(labelled('1, 80 kg × 8. Edit')).toBeTruthy()
    press(button('Done · last set'))
    expect(labelled('2, 80 kg × 8. Edit')).toBeTruthy()
  })
})

// Ported to WorkoutScreen.add.test.jsx (add exercise, no-progression blocks, discard lifecycle) and
// WorkoutScreen.steppers.test.jsx (weight controls, superset steppers).
todos('drop-set weight step (Set edit drawer, drawers-M2\'s exercise-drawers.test.jsx has no stepper case for it)', [
  'Workout.test.jsx:698 uses the configured reps weight step for drop-set weight controls',
])

// Workout.test.jsx:998 and :1012 (the .progline and its button) are dropped by design: the boards put
// progression in Exercise settings. The data cases below move to drawers-M2's exercise-drawers.test.jsx
// or lib/progression tests; not ported here, still open.
todos('progression settings data cases (Exercise settings, drawers-M2)', [
  'Workout.test.jsx:1040 does not save into a different duplicate occurrence after the entry list shifts [exercise-drawers entry-id guard]',
  'Workout.test.jsx:1060 does not save through a sheet left open from a replaced workout',
  'Workout.test.jsx:1081 leaves the active entry unchanged when progression settings are cancelled',
  'Workout.test.jsx:1096 saves the active policy, preserves completed rows, refreshes guidance immediately',
  'Workout.test.jsx:1156 settings rebuild: opens the plan\'s reps and stamps the prescription into the target',
  'Workout.test.jsx:1165 settings rebuild: carries last session\'s reps when the profile starts from the last session',
  'Workout.test.jsx:1215 saving unchanged keeps a double-progression raise in place',
  'Workout.test.jsx:1230 saving unchanged keeps a bodyweight climb',
  'Workout.test.jsx:1242 saving unchanged keeps a set the rep ceiling added, and the plan line reads the plan',
  'Workout.test.jsx:1253 keeps the plan\'s weight when only the reps are edited',
])

todos('whole-unit moves and swap (actions, map is drawers-M3)', [
  'Workout.test.jsx:1488 moves the selected standalone exercise one unit [workout-actions.moveEntryWithinPart; the map is drawers-M3]',
  'Workout.test.jsx:1513 moves the selected contiguous group as one unit without changing its metadata',
  'Workout.test.jsx:1534 disables both moves while a work timer can still write by index [use-workout.moveUnitAt]',
  'Workout.test.jsx:1545 opens the swap flow for the selected duplicate occurrence [exercise-drawers Swap step]',
])

// Focus cases ported to WorkoutScreen.focus.test.jsx; 1838 and 1854 are WorkoutScreen.test.jsx's
// hand-over and superset cases; 1806 is exercise-drawers.test.jsx:124. What has no home yet:
todos('focus view cases still open', [
  'Workout.test.jsx:1573 the progress dots move to a set without completing it (the ‹ › half is WorkoutScreen.test.jsx)',
  'Workout.test.jsx:1599 pairs adjacent exercises and can unpair them [map, drawers-M3]',
  'Workout.test.jsx:1716 renders and edits unilateral extras added through Set edit (exercise-drawers.test.jsx:169 covers both sides, not drops and bursts per side)',
  'Workout.test.jsx:1883 the superset switch selects the partner without completing work',
])

// Holds and sides: WorkoutScreen.hold.test.jsx. The footer's rest: WorkoutScreen.rest.test.jsx
// (its three gap todos live there). Superset scroll: dropped by design.

// FocusView.test.jsx:107, :143 and :153 are in WorkoutScreen.focus.test.jsx. :58, :75 and :92 are the
// old plan line and its switch: dropped by design (progression lives in Exercise settings).
