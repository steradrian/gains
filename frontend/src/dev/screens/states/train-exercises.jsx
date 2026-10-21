import { EXIDX } from '../../../lib/exercises.js'
import { exerciseNameText } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { exerciseDetailSheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import CreateExercise from '../../../views/train/exercises/CreateExercise.jsx'
import { registerScreens } from '../registry.js'

// Train slice 4 (PR-02, boards Tr6Detail, Tr6Fav, Tr6Create). The drawer is the real one, opened
// the way the app opens it, over a placeholder until the Exercises page (T6.0) is built; the toast
// is the app's real toast, held open; Create exercise is the real page. The mocked store is laid
// over the real one and its update stays in memory (mock-env.js), so a tap here saves nothing.
const NOOP = () => {}
const BENCH = '0025'   // barbell bench press
const daysAgo = n => { const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() - n); return d }
const benchDay = (n, sets) => {
  const day = daysAgo(n)
  const start = day.getTime()
  const d = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return { id: 'g-bench-' + n, d, start, end: start + 55 * 60000, name: 'Push A', prs: [],
    entries: [{ id: BENCH, target: { mode: 'reps', bodyweight: false }, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] }
}
const LOGGED = [benchDay(16, [[80, 8], [80, 7]]), benchDay(9, [[82.5, 6], [80, 8]]), benchDay(2, [[80, 8], [80, 8]])]
const CUSTOM = {
  id: 'g-cx-landmine', n: 'Landmine press', bp: 'shoulders', eq: 'barbell', custom: true, mode: 'reps',
  desc: 'Bar in a corner sleeve; press it up and forward from the shoulder.',
  tg: 'deltoids', primaries: ['deltoids'], secondaries: ['triceps', 'chest'], sm: ['triceps', 'chest'], muscleGroups: ['deltoids', 'triceps', 'chest'],
}
const base = (over = {}) => ({ unit: 'kg', workouts: LOGGED, favEx: [], customEx: [CUSTOM], active: null, ...over })

const placeholder = () => <div className="g-root" aria-hidden="true" />
const open = ex => async t => { exerciseDetailSheet(ex()); await t.wait(200) }
// The toast held open, as a person's finger would hold it, with the app's own words.
const faved = async tt => {
  exerciseDetailSheet(EXIDX[BENCH])
  await tt.wait(200)
  useUI.getState().toast(t('Added {0} to favourites', exerciseNameText(EXIDX[BENCH])), { action: t('Undo'), icon: 'starFill', onAction: NOOP })
  useUI.getState().pauseToast()
  await tt.wait(60)
}

registerScreens('Train: exercises', [
  { id: 'T6.1', title: 'Exercise drawer', note: 'Logged: the best set and its day, How to, Add to my plan, Your setup.', render: placeholder,
    mock: { S: base() }, play: open(() => EXIDX[BENCH]) },
  { id: 'T6.1n', title: 'Exercise drawer, never done', note: 'No best line; Progress and History say No sessions logged yet.', render: placeholder,
    mock: { S: base({ workouts: [] }) }, play: open(() => EXIDX[BENCH]) },
  { id: 'T6.1c', title: 'Exercise drawer, custom', note: 'Your own exercise: the ⋯ menu holds Edit and Delete; no catalogue fix link.', render: placeholder,
    mock: { S: base({ workouts: [] }) }, play: open(() => CUSTOM) },
  { id: 'T6.3', title: 'Added to favourites', note: 'The star filled, the toast with Undo for 8 s (held here).', render: placeholder,
    mock: { S: base({ favEx: [BENCH] }) }, play: faved },
  { id: 'T6.4', title: 'Create exercise', note: 'Empty: Weight × reps picked, More details folded.', render: () => <CreateExercise />,
    path: '/train/exercises/new', mock: { S: base() } },
  { id: 'T6.4f', title: 'Create exercise, filled', note: 'Editing a custom exercise: its body part, equipment and muscles in place.', render: () => <CreateExercise />,
    path: '/train/exercises/new?edit=' + CUSTOM.id, mock: { S: base() } },
])
