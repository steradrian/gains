import { isoOf, todayISO } from '../../../lib/format.js'
import WorkoutScreen from '../../../views/workout/WorkoutScreen.jsx'
import { exerciseSettingsSheet } from '../../../views/workout/exercise-drawers.jsx'
import { registerScreens } from '../registry.js'
import { Live, MAIN_DONE, PUSH, WARM_DONE, pushA } from './workout.jsx'

// Workout progression (W1.47 to W1.52): the progression line under the hero, a timed hold with it
// between the hero and the ring, the dashed "not counted" line for an exercise and for the whole
// workout, and Exercise settings (plain, and with the dumbbell's "Weight means"). The plans are
// stamped on the entries the way a session start stamps them; the sheet is the real one, opened by
// `play` over the real WorkoutScreen, in the gallery's in-memory store (mock-env.js).

const UP = { policy: 'double', kind: 'up', weight: 20, reps: 8, why: ['Top of the rep range in every set. {0} {1} more, back to {2} reps.', 2.5, 'kg', 8] }
const DELOAD = { policy: 'double', kind: 'deload', weight: 22, reps: 8, why: ['Stuck for {0} sessions. Deload to {1} {2}.', 2, 22, 'kg'] }
const HOLD = { policy: 'time', kind: 'up', sec: 55, why: ['Held every set for the full time. Target goes up by {0}s.', 5] }
const DB = 4 // the dumbbell shoulder press in Push A
const FLY = 6 // the cable fly
const PLANK = 5 // the third lift, swapped for a timed hold

/** Push A with the main lifts' plans stamped, a plank in the cool-down's place and `at` edited. */
const entries = (at = {}) => PUSH().map((e, k) => {
  const mine = k === PLANK ? { id: '2948', part: undefined, target: { mode: 'time', sec: 50, sets: 3, weight: 0 }, sets: Array.from({ length: 3 }, () => ({ sec: 50, w: 0, done: false })) } : null
  const base = mine || e
  const main = !base.part
  const plan = k === FLY ? UP : k === PLANK ? HOLD : { policy: 'double', kind: 'hold', why: ['Same weight, aim for {0} reps this time.', 8] }
  return { ...base, ...(main ? { plan } : {}), ...at[k] }
})
const pastPlank = () => {
  const day = new Date(todayISO() + 'T12:00:00')
  day.setDate(day.getDate() - 4)
  return { id: 'p-plank', d: isoOf(day), start: day.getTime(), end: day.getTime() + 40 * 60000, name: 'Push A', routineIds: [], prs: [],
    entries: [{ id: '2948', target: { mode: 'time', sec: 45, sets: 3 }, sets: Array.from({ length: 3 }, () => ({ sec: 45, w: 0, done: true })) }] }
}
const state = ({ cur = FLY, done = { ...MAIN_DONE, [FLY]: 1 }, at = {}, over = {} } = {}) => {
  const S = pushA({ cur, done, list: entries(at), over })
  return { ...S, workouts: [...S.workouts, pastPlank()] }
}
const stage = () => <Live><WorkoutScreen /></Live>
const open = idx => async t => { await t.wait(40); exerciseSettingsSheet(idx); await t.wait(200) }
// The dumbbell press logs per bell, 22 kg each, after two sessions short of the range (W1.47, W1.52).
const BELLS = { [DB]: { plan: DELOAD, target: { mode: 'reps', sets: 3, reps: 8, repsMin: 8, weight: 22, dbLoad: 'each' }, sets: Array.from({ length: 3 }, () => ({ w: 22, r: 8, done: false })) } }
const bells = { cur: DB, done: { ...MAIN_DONE, [DB]: 0, 3: 3, 5: 0 }, at: BELLS }

registerScreens('Workout', [
  { id: 'W1.47', title: 'Progression says deload', note: 'Dumbbell shoulder press, 22 kg each: the line in the warning tone with the arrow down, and the sets read "22 each × 8".',
    render: stage, mock: { S: state(bells) } },
  { id: 'W1.49', title: 'A timed hold, progressing', note: 'Plank hold: the progression line between the hero and the ring, target up by 5 s.',
    render: stage, mock: { S: state({ cur: PLANK, done: { ...WARM_DONE, 3: 3, 4: 3 } }) } },
  { id: 'W1.50', title: 'Exercise not counted', note: 'Cable fly kept out of progression: a dashed line with Undo in the progression line\'s place.',
    render: stage, mock: { S: state({ at: { [FLY]: { noProg: true } } }) } },
  { id: 'W1.51', title: 'Workout not counted', note: 'The whole workout is left out: "Not counted for progression" under the title and the dashed line with Undo.',
    render: stage,
    mock: { S: state({ at: Object.fromEntries(entries().map((e, k) => [k, { noProg: true }])), over: { noProg: true } }) } },
])

registerScreens('Workout: drawers', [
  { id: 'W1.48', title: 'Exercise settings', note: 'Cable fly: Today, Don\'t count today, the progression rule (Double progression, Linear, none), step, rep range and deload.',
    render: stage, mock: { S: state() }, play: open(FLY) },
  { id: 'W1.52', title: 'Exercise settings, dumbbells', note: 'Dumbbell shoulder press: Weight means (Each, Both) with the sets read "22 each", and the same rule rows.',
    render: stage, mock: { S: state(bells) }, play: open(DB) },
])
