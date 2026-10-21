import { Route, Routes } from 'react-router-dom'
import { EXIDX } from '../../../lib/exercises.js'
import { exConfigSheet, exercisePicker, replaceExerciseSheet } from '../../../sheets.jsx'
import RoutineEditor from '../../../views/routines/RoutineEditor.jsx'
import { registerScreens } from '../registry.js'
import { ROUTINES, routinesPlan } from './train-routines.jsx'

// The exercise picker, an exercise's settings and Replace (boards T5.1–T5.3, T5.5, T5.7), each the
// real drawer opened the way the editor opens it, over the routine's page: whatever App.jsx routes
// /train/routines/:id to (the editor), imported the way App.jsx imports it. The mocked store keeps
// every tap in memory (mock-env.js), and none of these plays saves anything: they open a drawer,
// tick a row, switch a tab or type in the search.
const PATH = '/train/routines/g-push'
const editor = () => <Routes><Route path="/train/routines/:id" element={<RoutineEditor />} /></Routes>
const NOOP = () => {}
const PUSH = ROUTINES[0]
const BENCH = EXIDX['0025']

// A picker the way the editor's Add exercise opens it: it takes several, and names the routine.
const addPicker = () => exercisePicker(NOOP, {
  routine: PUSH.name,
  multi: { label: n => `Add ${n} ${n === 1 ? 'exercise' : 'exercises'} to ${PUSH.name}`, onAdd: NOOP },
})
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
// A dispatched click, not .click(): the muscle map's muscles are SVG paths, which have no .click().
const tap = selector => document.querySelector(selector)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const tabButton = label => [...document.querySelectorAll('.g-bs .g-seg button')].find(b => b.textContent === label)
function typeInto(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

// Starred exercises for T5.2, and one logged set of a decline press for "you did" in T5.7. It is a
// barbell press, so it sits among the 20 rows Replace shows for the bench press (same kit first).
const favourites = ['0025', '0043', '0861', '0334']
const decline = { id: 'g-w-decline', d: '2026-10-14', start: 1, end: 2, unit: 'kg', name: 'Push A', routineIds: ['g-push'], prs: [], entries: [{ id: '0033', sets: [{ done: true, w: 30, r: 10 }] }] }
const state = (over = {}) => routinesPlan({ favEx: favourites, ...over })

const settings = (existing, options) => exConfigSheet(BENCH, existing, NOOP, NOOP, PUSH, null, NOOP, null, { superset: false, onSupersetChange: NOOP, removeUndo: true, ...options })

registerScreens('Train: routines picker', [
  { id: 'T5.1', title: 'Add exercise', note: 'The picker with one row ticked: the foot reads “Add 1 exercise to Push A”. Tabs All, Favourites, By muscle; body part, type and equipment chips.',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { addPicker(); await wait(250); tap('.g-bs .g-pk-item button.g-xrow'); await wait(100) } },
  { id: 'T5.1-nomatch', title: 'Add exercise, no exact match', note: '“No exact match. These come close:”, what is close, then Create your own.',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { addPicker(); await wait(250); typeInto(document.querySelector('.g-bs input[type="search"]'), 'dumbbell curl qwxz'); await wait(300) } },
  { id: 'T5.2', title: 'Add exercise, Favourites', note: 'The starred exercises only.',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { addPicker(); await wait(250); tabButton('Favourites')?.click(); await wait(150) } },
  { id: 'T5.3', title: 'Add exercise, By muscle', note: 'The app’s muscle map; a tap on Chest lists what trains it, with the count.',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { addPicker(); await wait(250); tabButton('By muscle')?.click(); await wait(500); tap('.g-bs .bm-m[aria-label="Chest"]'); await wait(150) } },
  { id: 'T5.5', title: 'Exercise settings', note: 'Bench press in Push A: the sets table, Progression, Intensifier, Replace exercise, Remove from routine (the editor offers an Undo).',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { settings({ sets: 4, mode: 'reps', reps: 8, repsMin: 6, weight: 80, inc: 2.5, prog: 'double' }); await wait(250) } },
  { id: 'T5.5-pyramid', title: 'Exercise settings, pyramid sets', note: 'A row a set: reps, weight and rest in each, Max, remove, Add set.',
    path: PATH, render: editor, mock: { S: state() },
    play: async () => { settings({ sets: 3, mode: 'reps', reps: 10, weight: 0, pyramid: [12, 10, 8], pyramidWeight: [60, 70, 80], pyramidRest: [90, 120, 150] }); await wait(250) } },
  { id: 'T5.7', title: 'Replace exercise', note: 'The same muscles, your equipment first; “you did 30 kg × 10” only for the decline press, which was logged.',
    path: PATH, render: editor, mock: { S: state({ workouts: [...routinesPlan().workouts, decline] }) },
    play: async () => { replaceExerciseSheet(BENCH.id, NOOP, { routine: PUSH.name }); await wait(250) } },
])
