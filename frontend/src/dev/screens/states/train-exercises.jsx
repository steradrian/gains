import { EXDB, EXIDX } from '../../../lib/exercises.js'
import { exerciseNameText, fmtNum } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { exerciseDetailSheet, exerciseHistorySheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import CreateExercise from '../../../views/train/exercises/CreateExercise.jsx'
import ExerciseProgress from '../../../views/train/exercises/ExerciseProgress.jsx'
import ExercisesScreen from '../../../views/train/exercises/ExercisesScreen.jsx'
import MuscleScreen from '../../../views/train/exercises/MuscleScreen.jsx'
import { registerScreens } from '../registry.js'

// Train slice 4 (PR-02, boards Tr6Exercises, Tr6Detail, Tr6Muscle, Tr6Fav, Tr6Create, Tr7Trend,
// Tr7PastSets). The pages are the real ones. The drawers are the real ones, opened the way the app
// opens them, over the Exercises page; the toast is the app's real toast, held open. The mocked store
// is laid over the real one and its update stays in memory (mock-env.js), so a tap here saves nothing.
const NOOP = () => {}
const BENCH = '0025'   // barbell bench press
const SQUAT = '0043'   // barbell full squat
const ROW = '0027'     // barbell bent over row
const DB_ROW = '0293'  // dumbbell bent over row
const daysAgo = n => { const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() - n); return d }
const dayOf = (n, id, sets) => {
  const day = daysAgo(n)
  const start = day.getTime()
  const d = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return { id: `g-${id}-${n}`, d, start, end: start + 55 * 60000, name: 'Push A', prs: [],
    entries: [{ id, target: { mode: 'reps', bodyweight: false }, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] }
}
const LOGGED = [
  dayOf(16, BENCH, [[80, 8], [80, 7]]), dayOf(9, BENCH, [[82.5, 6], [80, 8]]), dayOf(2, BENCH, [[80, 8], [80, 8]]),
  dayOf(12, SQUAT, [[100, 5], [102.5, 5]]), dayOf(5, ROW, [[70, 8], [72.5, 7]]), dayOf(3, DB_ROW, [[32, 9], [32, 8]]),
]
// Nine bench sessions over four months, climbing: the trend, its new bests and the past sets.
const BENCH_CLIMB = [
  [110, [[72.5, 8], [72.5, 8]]], [95, [[75, 8], [72.5, 8]]], [80, [[77.5, 6], [75, 8]]], [66, [[77.5, 7], [77.5, 6]]],
  [50, [[80, 6], [77.5, 8]]], [37, [[80, 7], [80, 6]]], [23, [[82.5, 5], [80, 7]]], [9, [[82.5, 6], [80, 7], [80, 7]]], [2, [[85, 5], [82.5, 6]]],
].map(([n, sets]) => dayOf(n, BENCH, sets))
const CUSTOM = {
  id: 'g-cx-landmine', n: 'Landmine press', bp: 'shoulders', eq: 'barbell', custom: true, mode: 'reps',
  desc: 'Bar in a corner sleeve; press it up and forward from the shoulder.',
  tg: 'deltoids', primaries: ['deltoids'], secondaries: ['triceps', 'chest'], sm: ['triceps', 'chest'], muscleGroups: ['deltoids', 'triceps', 'chest'],
}
const base = (over = {}) => ({ unit: 'kg', workouts: LOGGED, favEx: [BENCH, SQUAT, ROW], customEx: [CUSTOM], active: null, ...over })

const exercises = () => <ExercisesScreen />
const progress = () => <ExerciseProgress />
const open = ex => async t => { exerciseDetailSheet(ex()); await t.wait(200) }
// The toast held open, as a person's finger would hold it, with the app's own words.
const faved = async tt => {
  exerciseDetailSheet(EXIDX[BENCH])
  await tt.wait(200)
  useUI.getState().toast(t('Added {0} to favourites', exerciseNameText(EXIDX[BENCH])), { action: t('Undo'), icon: 'starFill', onAction: NOOP })
  useUI.getState().pauseToast()
  await tt.wait(60)
}
const searched = text => async tt => {
  await tt.type(t('Search {0} exercises', fmtNum(EXDB.length + 1)), text)
  await tt.wait(200)
}

registerScreens('Train: exercises', [
  { id: 'T6.0', title: 'Exercises', note: 'Six logged exercises with their best and estimated 1RM, then the library A to Z, favourites first.', render: exercises,
    path: '/train/exercises', mock: { S: base() } },
  { id: 'T6.0s', title: 'Exercises, no exact match', note: 'A search with nothing exact: what comes close, then Create your own.', render: exercises,
    path: '/train/exercises', mock: { S: base() }, play: searched('dumbbell curl qwxz') },
  { id: 'T6.0f', title: 'Exercises, favourites on', note: 'The Favourites chip pressed: only the starred ones, with the count in the search.', render: exercises,
    path: '/train/exercises', mock: { S: base() }, play: async tt => { await tt.click('Favourites · 3') } },
  { id: 'T6.1', title: 'Exercise drawer', note: 'Logged: the best set and its day, How to, Add to my plan, Your setup.', render: exercises,
    path: '/train/exercises', mock: { S: base() }, play: open(() => EXIDX[BENCH]) },
  { id: 'T6.1n', title: 'Exercise drawer, never done', note: 'No best line; Progress and History say No sessions logged yet.', render: exercises,
    path: '/train/exercises', mock: { S: base({ workouts: [] }) }, play: open(() => EXIDX[BENCH]) },
  { id: 'T6.1c', title: 'Exercise drawer, custom', note: 'Your own exercise: the ⋯ menu holds Edit and Delete; no catalogue fix link.', render: exercises,
    path: '/train/exercises', mock: { S: base({ workouts: [] }) }, play: open(() => CUSTOM) },
  { id: 'T6.2', title: 'By muscle, Chest', note: 'Tap another muscle to switch; chest exercises, yours first with their bests.', render: () => <MuscleScreen />,
    path: '/train/exercises/muscles?muscle=chest', mock: { S: base() } },
  { id: 'T6.3', title: 'Added to favourites', note: 'The star filled, the toast with Undo for 8 s (held here).', render: exercises,
    path: '/train/exercises', mock: { S: base({ favEx: [BENCH] }) }, play: faved },
  { id: 'T6.4', title: 'Create exercise', note: 'Empty: Weight × reps picked, More details folded.', render: () => <CreateExercise />,
    path: '/train/exercises/new', mock: { S: base() } },
  { id: 'T6.4f', title: 'Create exercise, filled', note: 'Editing a custom exercise: its body part, equipment and muscles in place.', render: () => <CreateExercise />,
    path: '/train/exercises/new?edit=' + CUSTOM.id, mock: { S: base() } },
  { id: 'T7.0', title: 'Progress', note: 'The estimated 1RM and its trend, the range and metric, the line, the tiles, New bests, the calculator.', render: progress,
    path: '/progress/strength?ex=' + BENCH, mock: { S: base({ workouts: [...BENCH_CLIMB, ...LOGGED.slice(3)] }) } },
  { id: 'T7.0e', title: 'Progress, one session', note: 'Fewer than two sessions: "Log it twice to see a trend." in place of the line, no trend in the hero.', render: progress,
    path: '/progress/strength?ex=' + BENCH, mock: { S: base({ workouts: [LOGGED[2]] }) } },
  { id: 'T7.0u', title: 'Progress, never done', note: 'An exercise with no sets stays on its page with the picker, and says so.', render: progress,
    path: '/progress/strength?ex=0032', mock: { S: base() } },
  { id: 'T7.0n', title: 'Progress, no lifts', note: 'No workouts at all: No lifts yet.', render: progress,
    path: '/progress/strength?ex=' + BENCH, mock: { S: base({ workouts: [] }) } },
  { id: 'T7.1', title: 'Past sets', note: 'The History view: a card per session, each set, New best on the set that beat the best before it.', render: progress,
    path: '/progress/strength?ex=' + BENCH + '&view=sets', mock: { S: base({ workouts: [...BENCH_CLIMB, ...LOGGED.slice(3)] }) } },
  { id: 'T7.1d', title: 'History drawer, in the workout', note: 'The light drawer a running workout opens instead of leaving: the top-set curve and the same list.', render: exercises,
    path: '/train/exercises', mock: { S: base({ workouts: [...BENCH_CLIMB, ...LOGGED.slice(3)] }) }, play: async tt => { exerciseHistorySheet(BENCH); await tt.wait(200) } },
])
