import { EXDB } from '../../../lib/exercises-data.js'
import { isoOf, todayISO } from '../../../lib/format.js'
import { dayOptionsSheet, startChooserSheet } from '../../../sheets.jsx'
import TrainScreen from '../../../views/train/TrainScreen.jsx'
import { registerScreens } from '../registry.js'
import { base } from './train.jsx'

// Train's drawers (T2.1 Start a workout, T2.2 Day options), each the real one opened the way Train
// opens it, over T2.0 (the Train screen, as train.jsx draws it). The plan in the mocked store is
// the boards': Push A today, Pull A logged four days ago, Legs missed two days ago.
const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }
const three = (bp, eq) => EXDB.filter(e => e.bp === bp && e.eq === eq).slice(0, 3)
  .map(e => ({ id: e.id, mode: 'reps', sets: 3, reps: 8, weight: 40 }))
const ROUTINES = [
  { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: three('chest', 'barbell') },
  { id: 'g-pull', name: 'Pull A', emoji: 'dumbbell', ex: three('back', 'cable') },
  { id: 'g-legs', name: 'Legs', emoji: 'dumbbell', ex: three('upper legs', 'barbell') },
]
const pulled = () => {
  const day = daysAgo(4)
  const start = day.getTime()
  return {
    id: 'g-w1', d: isoOf(day), start, end: start + 50 * 60000, name: 'Pull A', routineIds: ['g-pull'], prs: [],
    entries: ROUTINES[1].ex.map(cfg => ({ id: cfg.id, rid: 'g-pull', target: cfg, sets: [{ w: 40, r: 8, done: true }] })),
  }
}
const plan = (over = {}) => ({
  routines: ROUTINES,
  week: { [daysAgo(0).getDay()]: ['g-push'], [daysAgo(2).getDay()]: ['g-legs'], [daysAgo(4).getDay()]: ['g-pull'] },
  dayPlan: {}, dayNotes: {}, missedSeen: {}, queue: null, active: null, workouts: [pulled()],
  ...over,
})
const train = () => <TrainScreen {...base} />
const open = fn => async t => { fn(); await t.wait(200) }

registerScreens('Train: drawers', [
  { id: 'T2.1', title: 'Start a workout', note: 'Planned today first, the missed routine last; weigh-in after a pick.', render: train,
    mock: { S: plan() }, play: open(startChooserSheet) },
  { id: 'T2.1e', title: 'Start a workout, no routines', note: 'T2.9’s three ways to a plan, then Freestyle.', render: train,
    mock: { S: plan({ routines: [], week: {}, workouts: [] }) }, play: open(startChooserSheet) },
  { id: 'T2.2', title: 'Day options', note: 'Today’s ⋯: change, a different workout, rest (moves to the next free day), the note.', render: train,
    mock: { S: plan({ dayNotes: { [todayISO()]: { tag: 'injured', text: 'Shoulder felt tight', _ts: 1 } } }) },
    play: open(() => dayOptionsSheet(todayISO())) },
])
