import { EXDB } from '../../../lib/exercises-data.js'
import { EXIDX } from '../../../lib/exercises.js'
import { exerciseNameText, isoOf, todayISO } from '../../../lib/format.js'
import { MUSCLES } from '../../../lib/muscles.js'
import { deleteWorkoutWithUndo, shareWorkoutSheet, workoutDetailSheet } from '../../../sheets.jsx'
import HistoryScreen from '../../../views/train/history/HistoryScreen.jsx'
import MuscleScreen from '../../../views/train/load/MuscleScreen.jsx'
import TrainingLoadScreen from '../../../views/train/load/TrainingLoadScreen.jsx'
import { registerScreens } from '../registry.js'

// Train slice 5, History: T8.0 with a few weeks of the boards' sessions (Push A, Pull A, Legs),
// T8.2 with nothing logged, and over T8.0 the workout drawer (T8.1, also with a workout running),
// Share as image (T8.3) and the toast after a delete (T8.4). Every write, the delete and its Undo
// included, goes to the gallery's in-memory store (mock-env.js installMocks), never to the copy.
const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }
const pick = (bp, eq, n) => EXDB.filter(e => e.bp === bp && e.eq === eq).slice(0, n).map(e => e.id)
const PUSH = [...pick('chest', 'barbell', 2), ...pick('shoulders', 'dumbbell', 2), ...pick('upper arms', 'cable', 2)]
const PULL = [...pick('back', 'cable', 3), ...pick('upper arms', 'dumbbell', 2)]
const LEGS = [...pick('upper legs', 'barbell', 3), ...pick('lower legs', 'machine', 1)]
const sets = (w, reps) => reps.map(r => ({ w, r, done: true }))
const session = (id, ago, name, ids, w, { prs = [], minutes = 52, note } = {}) => {
  const day = daysAgo(ago)
  day.setHours(18, 0, 0, 0)
  const start = day.getTime()
  const entries = ids.map((exId, i) => ({ id: exId, target: { mode: 'reps' }, sets: sets(Math.max(10, w - i * 10), [8, 8, 7]) }))
  const vol = entries.reduce((v, e) => v + e.sets.reduce((s, x) => s + x.w * x.r, 0), 0)
  return { id, d: isoOf(daysAgo(ago)), start, end: start + minutes * 60000, name, routineIds: [], prs, vol, entries, ...(note ? { note } : {}) }
}
const WORKOUTS = [
  session('h-1', 23, 'Push A', PUSH, 80, { minutes: 55 }),
  session('h-2', 21, 'Pull A', PULL, 70, { minutes: 50 }),
  session('h-3', 19, 'Legs', LEGS, 110, { minutes: 61 }),
  session('h-4', 16, 'Push A', PUSH, 82.5, { minutes: 55, prs: [PUSH[0]] }),
  session('h-5', 9, 'Pull A', PULL, 72.5, { minutes: 48 }),
  session('h-6', 7, 'Legs', LEGS, 112.5, { minutes: 61 }),
  session('h-7', 2, 'Push A', PUSH, 85, { prs: [PUSH[0], PUSH[2]], note: 'Felt strong. Bench moved fast.' }),
  session('h-8', 0, 'Pull A', PULL, 75, { minutes: 48 }),
]
const shown = WORKOUTS[6]
const history = (over = {}) => ({
  workouts: WORKOUTS, routines: [], active: null, shareMap: true,
  dayNotes: { [isoOf(daysAgo(12))]: { tag: 'travel', text: 'Away for work', _ts: 1 } },
  ...over,
})
const nameOf = e => (EXIDX[e.id] ? exerciseNameText(EXIDX[e.id]) : e.id)
const page = () => <HistoryScreen />
const open = fn => async t => { fn(); await t.wait(200) }
const RUNNING = { id: 'h-run', d: todayISO(), start: Date.now() - 20 * 60000, routineIds: [], name: 'Legs', cur: 0, entries: [] }

registerScreens('Train slice 5', [
  { id: 'T8.0', title: 'History', note: 'The month with its trained days, then the weeks; a day note keeps its place.', render: page, path: '/train/history',
    mock: { S: history() } },
  { id: 'T8.2', title: 'History, nothing logged', note: 'Start a workout, or log a past one.', render: page, path: '/train/history',
    mock: { S: history({ workouts: [], dayNotes: {} }) } },
  { id: 'T8.1', title: 'Workout', note: 'Over T8.0: tiles, muscle map, exercises with new bests, the note, then the rows.', render: page, path: '/train/history',
    mock: { S: history() }, play: open(() => workoutDetailSheet(shown)) },
  { id: 'T8.1r', title: 'Workout, another one running', note: 'Repeat today and Edit sets say to finish the running one first.', render: page, path: '/train/history',
    mock: { S: history({ active: RUNNING }) }, play: open(() => workoutDetailSheet(shown)) },
  { id: 'T8.3', title: 'Share as image', note: 'The card on the stage in the accent; Share, Save image, Copy text.', render: page, path: '/train/history',
    mock: { S: history() }, play: open(() => shareWorkoutSheet(shown, nameOf)) },
  { id: 'T8.4', title: 'Workout deleted', note: 'Gone from the list and the month at once; Undo for 8 s (in memory here).', render: page, path: '/train/history',
    mock: { S: history() }, play: open(() => deleteWorkoutWithUndo(shown)) },
])

// Training load (T9.0–T9.5) and a muscle (T9.6), over the same sessions, with the plan they come
// from (Push A Monday, Pull A Wednesday, Legs Friday) so this week reads against it. The metric
// switch and every other write go to the in-memory store too.
const routine = (id, name, ids) => ({ id, name, ex: ids.map(exId => ({ id: exId, sets: 3 })) })
const PLAN = {
  routines: [routine('r-push', 'Push A', PUSH), routine('r-pull', 'Pull A', PULL), routine('r-legs', 'Legs', LEGS)],
  week: { 1: ['r-push'], 3: ['r-pull'], 5: ['r-legs'] },
}
const rated = WORKOUTS.map(w => ({ ...w, entries: w.entries.map(e => ({ ...e, sets: e.sets.map((s, i) => ({ ...s, rir: i === 2 ? 1 : 2 })) })) }))
const load = (over = {}) => history({ ...PLAN, ...over })
// One set on every muscle this week (a snapshot exercise per muscle), for "every muscle got some work".
const everyMuscle = { id: 'h-all', d: todayISO(), start: Date.now() - 3600000, end: Date.now(), name: 'Full body', routineIds: [], prs: [],
  entries: MUSCLES.map(m => ({ id: 'all-' + m, exercise: { n: m, primaries: [m], secondaries: [] }, sets: [{ w: 0, r: 10, done: true }] })) }
const noLoad = WORKOUTS.map(w => ({ ...w, entries: w.entries.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, w: 0 })) })) }))
const trends = () => <TrainingLoadScreen />

registerScreens('Train slice 5', [
  { id: 'T9.0', title: 'Training load', note: 'Activity by time, then Balance this week against the plan, four rows and the muscles not trained.', render: trends, path: '/progress/load',
    mock: { S: load() } },
  { id: 'T9.1', title: 'Training load, by volume', note: 'The same 12 months shaded by volume (kept on the profile).', render: trends, path: '/progress/load',
    mock: { S: load({ heatmapMetric: 'vol' }) } },
  { id: 'T9.2', title: 'Balance, 30 days', note: 'The last 30 days, busiest first; Hard sets shows when sets are rated.', render: trends, path: '/progress/load',
    mock: { S: load({ workouts: rated }) }, play: async t => { await t.click('30d') } },
  { id: 'T9.3', title: 'Balance, every muscle', note: 'Show more: every muscle this week, then Show less.', render: trends, path: '/progress/load',
    mock: { S: load() }, play: async t => { await t.click('Show more') } },
  { id: 'T9.0a', title: 'Balance, every muscle trained', note: 'The note replaces the Not trained chips.', render: trends, path: '/progress/load',
    mock: { S: load({ workouts: [...WORKOUTS, everyMuscle] }) } },
  { id: 'T9.4', title: 'Fatigue', note: 'The fixed bands, the muscles carrying fatigue, and the line when a planned session fits.', render: trends, path: '/progress/load?view=fatigue',
    mock: { S: load() } },
  { id: 'T9.5', title: 'Strength', note: 'Retained strength, the muscles losing it, then each lift’s estimated 1RM.', render: trends, path: '/progress/load?view=strength',
    mock: { S: load() } },
  { id: 'T9.5e', title: 'Strength, no estimated 1RM', note: 'Only unloaded sets: no lift to estimate.', render: trends, path: '/progress/load?view=strength',
    mock: { S: load({ workouts: noLoad }) } },
  { id: 'T9.E', title: 'Effort', note: 'The fourth segment, once sets are rated (owner question 4).', render: trends, path: '/progress/load?view=effort',
    mock: { S: load({ workouts: rated }) } },
  { id: 'T9.6', title: 'A muscle: Chest', note: 'This week against 10 to 12 sets, the last 4 weeks, fatigue, what trained it, and Try next.', render: () => <MuscleScreen slug="chest" />,
    path: '/progress/load/muscle/chest', mock: { S: load() } },
])
