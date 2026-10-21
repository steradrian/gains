import { useUI } from '../../../store/useUI.js'
import WorkoutScreen from '../../../views/workout/WorkoutScreen.jsx'
import { workoutMapSheet, workoutOptionsSheet, addExerciseSheet } from '../../../views/workout/drawers.js'
import { registerScreens } from '../registry.js'
import { Live, LONG, MAIN_DONE, pushA } from './workout.jsx'

// Workout drawers-M3 (W1.37, W1.23, W1.45, W1.18, W1.19, W1.20, W1.21): the map, Add exercise, its
// Undo toast, Workout options and Workout settings, each the real drawer opened by `play` over the
// real WorkoutScreen. Reorders and adds run against the gallery's in-memory store (mock-env.js).

const stage = () => <Live><WorkoutScreen /></Live>
const FLY = { cur: 6, done: { ...MAIN_DONE, 6: 1 } }
const open = fn => async t => { await t.wait(40); fn(); await t.wait(200) }

registerScreens('Workout: drawers', [
  { id: 'W1.37', title: 'Map', note: 'Push A · 12 exercises and the clock: Warm-up · done, Workout · 3 of 6 done, Cool-down with Skip cool-down, the A1/A2 bracket, Add exercise, Make superset, Workout options.',
    render: stage, mock: { S: pushA(FLY) }, play: open(workoutMapSheet) },
  { id: 'W1.23', title: 'Map, reordering', note: 'The Dumbbell row moved down one place with the keyboard handle: it stays in its phase.',
    render: stage, mock: { S: pushA(FLY) },
    play: async t => {
      await open(workoutMapSheet)(t)
      const grip = document.querySelectorAll('.g-mr-grip')[4]
      grip?.focus()
      grip?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
      await t.wait(120)
    } },
  { id: 'W1.45', title: 'Long map', note: '20 exercises: the list scrolls under the pinned hint and foot.',
    render: stage, mock: { S: pushA({ cur: 9, list: LONG(), done: { ...MAIN_DONE, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 1 }, over: { name: 'Legs and core' } }) },
    play: open(workoutMapSheet) },
  { id: 'W1.18', title: 'Add exercise', note: 'Add exercise · This workout: search, chips, Add routine, Create your own, rows with Last or In this workout · added, and +.',
    render: stage, mock: { S: pushA(FLY) }, play: open(() => addExerciseSheet()) },
  { id: 'W1.19', title: 'Exercise added', note: '"Added … after … · 8 of 13" (every exercise counts) with Undo for 8 s (held).',
    render: stage, mock: { S: pushA(FLY) },
    play: async t => {
      await open(() => addExerciseSheet())(t)
      document.querySelector('.g-pk-add')?.click()
      useUI.getState().pauseToast?.()
      await t.wait(120)
    } },
  { id: 'W1.20', title: 'Workout options', note: 'Reorder exercises, Rename workout, Session note, Add routine, Workout settings, the progression switch, Discard workout.',
    render: stage, mock: { S: pushA(FLY) }, play: open(() => workoutOptionsSheet()) },
  { id: 'W1.21', title: 'Workout settings', note: 'The step inside Options with the back button: Next exercise on its own, Rest timer, Sound, Plate loading, Effort per set, Keep screen on.',
    render: stage, mock: { S: pushA(FLY) },
    play: async t => { await open(() => workoutOptionsSheet())(t); await t.click('Workout settings'); await t.wait(120) } },
])
