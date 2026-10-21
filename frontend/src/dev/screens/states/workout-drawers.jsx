import { exOr } from '../../../lib/exercises.js'
import { isoOf, todayISO } from '../../../lib/format.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import WorkoutScreen from '../../../views/workout/WorkoutScreen.jsx'
import { setEditSheet, howToSheet, platesSheet, restWheelSheet } from '../../../views/workout/drawers.js'
import { removeSetAt, removeExerciseWithUndo, swapEntryWithUndo } from '../../../views/workout/workout-actions.js'
import { replaceCandidates } from '../../../sheets/exercise-swap.jsx'
import { registerScreens } from '../registry.js'
import { Live, PUSH, pushA, WARM_DONE, MAIN_DONE } from './workout.jsx'

// Workout drawers-M2, the exercise drawers (W1.4, W1.12 to W1.17, W1.25, W1.33, W1.34, W1.43): each
// the real drawer opened by `play` over the real WorkoutScreen, on workout.jsx's Push A. Here Push A
// is also a routine, so Swap offers "Also in Push A". A toast is the real action's, run against the
// gallery's in-memory store (mock-env.js installMocks) and held open.

const ROUTINE = { id: 'push', name: 'Push A', ex: PUSH().map(e => ({ id: e.id, ...e.target, ...(e.part ? { part: e.part } : {}) })) }
// Thursday's cool-down, so the stretch's How to says what was held (W1.43).
const stretched = () => {
  const day = new Date(todayISO() + 'T12:00:00')
  day.setDate(day.getDate() - 6)
  day.setHours(19, 0, 0, 0)
  const sets = [1, 2].flatMap(() => [{ sec: 30, w: 0, side: 'L', done: true }, { sec: 30, w: 0, side: 'R', done: true }])
  return { id: 'p-s', d: isoOf(day), start: day.getTime(), end: day.getTime() + 10 * 60000, name: 'Push A', routineIds: ['push'], prs: [],
    entries: [{ id: '1053', rid: 'push', part: 'cooldown', target: { mode: 'time', sec: 30, sets: 2, side: true }, sets }] }
}
const state = opts => {
  const S = pushA(opts)
  return {
    ...S, routines: [ROUTINE], workouts: [...S.workouts, stretched()],
    active: { ...S.active, entries: S.active.entries.map(e => ({ ...e, rid: 'push' })) },
  }
}
const stage = props => () => <Live {...props}><WorkoutScreen /></Live>
const open = fn => async t => { await t.wait(40); fn(); await t.wait(200) }
const held = fn => async t => { await t.wait(40); fn(); useUI.getState().pauseToast?.(); await t.wait(80) }
const FLY = { cur: 6, done: { ...MAIN_DONE, 6: 1 } }

registerScreens('Workout: drawers', [
  { id: 'W1.4', title: 'Time left', note: 'The rest wheel over the rest: Scroll to 0:00 to end the rest now, Skip, Done.',
    render: stage({ timer: { left: 102, total: 120, forIdx: 3 } }), mock: { S: state({ done: { ...WARM_DONE, 3: 1 } }) }, play: open(restWheelSheet) },
  { id: 'W1.12', title: 'Set edit', note: 'Cable fly set 1: Weight and Reps, the effort chips, warm-up and failure switches, drop, burst, copy, the note, Remove and Save set 1.',
    render: stage(), mock: { S: { ...state(FLY), effort: 'rir' } }, play: open(() => setEditSheet(6, 0)) },
  { id: 'W1.13', title: 'Set removed', note: '"Set 3 gone." with Undo for 8 s (held).',
    render: stage(), mock: { S: state(FLY) }, play: held(() => removeSetAt(6, 2, {})) },
  { id: 'W1.14', title: 'How to · Cable fly', note: 'The clip, tags, steps, muscles, best and last, Exercise settings, the extra rows, Remove, Swap, Back to set.',
    render: stage(), mock: { S: state(FLY) }, play: open(() => howToSheet(6)) },
  { id: 'W1.15', title: 'Swap', note: 'The second step inside How to: search, chips, Last or Never done, This workout only or Also in Push A.',
    render: stage(), mock: { S: state(FLY) }, play: async t => { await open(() => howToSheet(6))(t); await t.click('Swap'); await t.wait(120) } },
  { id: 'W1.16', title: 'Swapped', note: 'The toast with one Undo for the session (and the routine, for Also in).',
    render: stage(), mock: { S: state(FLY) },
    play: held(() => swapEntryWithUndo(6, replaceCandidates(useStore.getState().S, exOr('0188'))[0])) },
  { id: 'W1.17', title: 'Exercise removed', note: '"Removed Cable middle fly" with Undo for 8 s; the next one takes over.',
    render: stage(), mock: { S: state(FLY) }, play: held(() => removeExerciseWithUndo(6)) },
  { id: 'W1.25', title: 'Plate loading', note: 'Load 80 kg: the bar drawing, Total, Bar, Each side, the Gym setup line and Bar and loading.',
    render: stage(), mock: { S: state({ done: WARM_DONE }) }, play: open(() => platesSheet(3)) },
  { id: 'W1.33', title: 'How to, first time', note: 'Glute bridge, never logged and a warm-up: the baseline line and the warm-up line.',
    render: stage(), mock: { S: state({ cur: 0, done: { 0: 1 } }) }, play: open(() => howToSheet(0)) },
  { id: 'W1.34', title: 'How to · Bench press', note: 'Best and Last from three past sessions.',
    render: stage(), mock: { S: state({ done: WARM_DONE }) }, play: open(() => howToSheet(3)) },
  { id: 'W1.43', title: 'How to · stretch', note: 'Kneeling hip flexor stretch, a cool-down: Held 2 × 30 s each side and Last.',
    render: stage(), mock: { S: state({ cur: 9, done: { ...MAIN_DONE, 6: 3, 7: 3, 8: 3 }, over: { offered: { cooldown: true } } }) }, play: open(() => howToSheet(9)) },
])
