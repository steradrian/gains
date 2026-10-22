import { Route, Routes } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { isoOf, todayISO } from '../../../lib/format.js'
import { DISCARD_UNDO_MS, discardedText } from '../../../lib/workout-discard.js'
import { REOPEN_MS } from '../../../lib/workout-reopen.js'
import { useUI } from '../../../store/useUI.js'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { cooldownOfferSheet, discardSheet, finishSheet, staleWorkoutSheet, warmupOfferSheet } from '../../../views/workout/finish-drawers.js'
import ReadyScreen from '../../../views/workout/ReadyScreen.jsx'
import SummaryScreen from '../../../views/workout/SummaryScreen.jsx'
import WorkoutRoute from '../../../views/workout/WorkoutRoute.jsx'
import { registerScreens } from '../registry.js'
import { NOOP, both } from './today-fixture.js'

// Workout, start and finish (finish-M2, boards Wk1Planned to Wk2First). Ready (W1.1) and the
// summary (W2.0, W2.2) are the real screens on their routes; the drawers are the real ones, opened
// the way the app opens them, over the screen they belong to: the warm-up offer over Ready, the
// cool-down offer and Finish and Discard over the running workout, the left-open prompt over
// Today. The toasts (W1.26, W2.1) are the app's real toast with the real copy, held open over
// Today. Nothing here saves, discards or reopens: the mocked store keeps changes in memory and the
// toasts' actions do nothing.

const MIN = 60000
const HOUR = 60 * MIN
const NOW = Date.now()
const SITUP = '0001', BENCH = '0025', FLY = '0227', INCLINE = '0314', PRESS = '0426'
const CHEST_STRETCH = '1777', SHOULDER_STRETCH = '1980', RUN = '4229'

const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }

// Push A with a warm-up and a cool-down: Ready's three groups, the offers' counts and minutes.
const PUSH = {
  id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: [
    { id: SITUP, sets: 2, reps: 15, part: 'warmup' },
    { id: BENCH, sets: 3, reps: 8, weight: 80 },
    { id: INCLINE, sets: 3, reps: 10, weight: 30 },
    { id: PRESS, sets: 3, reps: 10, weight: 22 },
    { id: CHEST_STRETCH, mode: 'time', sets: 2, sec: 30, side: true, part: 'cooldown' },
    { id: SHOULDER_STRETCH, mode: 'time', sets: 2, sec: 30, side: true, part: 'cooldown' },
  ],
}

const setsOf = (w, ...reps) => reps.map(r => ({ w, r, done: true }))
const past = (n, i) => {
  const start = daysAgo(n).getTime()
  return {
    id: 'g-past' + i, d: isoOf(daysAgo(n)), start, end: start + 52 * MIN, name: 'Push A', routineIds: ['g-push'], prs: [],
    entries: [{ id: BENCH, rid: 'g-push', target: { mode: 'reps', sets: 3, reps: 8, weight: 80 }, sets: setsOf(80, 8, 8, 8) }],
  }
}
const PAST = [past(7, 1), past(14, 2), past(21, 3)]

const store = (over = {}) => ({
  routines: [PUSH], week: { [new Date().getDay()]: ['g-push'] }, dayPlan: {}, dayNotes: {}, missedSeen: {}, queue: null,
  active: null, workouts: PAST, weighIn: false, bodyweight: [], unit: 'kg', ...over,
})

/* ------------------------------------------------------- a session running -- */

const row = (w, r, done, at) => ({ w, r, done, ...(done ? { at } : {}) })
const reps = (id, sets, part) => ({
  id, rid: 'g-push', target: { mode: 'reps', sets: sets.length, reps: 8, weight: 80 }, sets, ...(part ? { part } : {}),
})
const hold = id => ({
  id, rid: 'g-push', part: 'cooldown', target: { mode: 'time', sets: 2, sec: 30, side: true },
  sets: [{ w: 0, r: 0, sec: 30, done: false }, { w: 0, r: 0, sec: 30, done: false }],
})
const running = (entries, over = {}) => ({
  id: 'g-a1', d: todayISO(), start: NOW - 24 * MIN, routineIds: ['g-push'], name: 'Push A', bw: null, cur: 0, entries, ...over,
})
const doneSets = (w, r, n, at) => Array.from({ length: n }, (_, i) => row(w, r, true, at + i * 3 * MIN))

// W1.10: every set ticked and the bench heavier than the history's best.
const ALL_DONE = running([
  reps(SITUP, doneSets(0, 15, 2, NOW - 23 * MIN), 'warmup'),
  reps(BENCH, doneSets(85, 8, 3, NOW - 20 * MIN)),
  reps(INCLINE, doneSets(30, 10, 3, NOW - 12 * MIN)),
  reps(PRESS, doneSets(22, 10, 3, NOW - 5 * MIN)),
])
// W1.11: one set left on the bench, the other two exercises untouched.
const SETS_LEFT = running([
  reps(BENCH, [...doneSets(80, 8, 2, NOW - 15 * MIN), row(80, 8, false)]),
  reps(INCLINE, [row(30, 10, false), row(30, 10, false), row(30, 10, false)]),
  reps(PRESS, [row(22, 10, false), row(22, 10, false), row(22, 10, false)]),
])
// W1.46: a few sets logged.
const SOME_LOGGED = running([
  reps(BENCH, [...doneSets(80, 8, 2, NOW - 12 * MIN), row(80, 8, false)]),
  reps(INCLINE, [row(30, 10, false), row(30, 10, false), row(30, 10, false)]),
])
// W1.40: the main work is done and two timed holds are waiting; no cool-down offered yet.
const MAIN_DONE = running([
  reps(SITUP, doneSets(0, 15, 2, NOW - 40 * MIN), 'warmup'),
  reps(BENCH, doneSets(80, 8, 3, NOW - 35 * MIN)),
  reps(INCLINE, doneSets(30, 10, 3, NOW - 25 * MIN)),
  reps(PRESS, doneSets(22, 10, 3, NOW - 12 * MIN)),
  hold(CHEST_STRETCH),
  hold(SHOULDER_STRETCH),
], { start: NOW - 48 * MIN })
// W1.27: started 23 h ago, last set ticked 22 h ago.
const LEFT_OPEN = running([
  reps(BENCH, doneSets(80, 8, 3, NOW - 22 * HOUR)),
  reps(INCLINE, [...doneSets(30, 10, 1, NOW - 22 * HOUR + 20 * MIN), row(30, 10, false), row(30, 10, false)]),
], { start: NOW - 23 * HOUR })

/* ------------------------------------------------------------ a saved one -- */

// Sun 18 Oct 2026 against the Sunday before: the delta, the bests and what comes next.
const SAVED_DAY = '2026-10-18'
const at = (d, hm) => Date.parse(d + 'T' + hm + ':00')
const saved = (id, d, routineIds, entries, over = {}) => ({
  id, d, start: at(d, '17:42'), end: at(d, '18:34'), routineIds, name: 'Push A', entries, ...over,
})
const SAVED = saved('g-w2', SAVED_DAY, ['g-push'], [
  { id: BENCH, rid: 'g-push', sets: setsOf(80, 8, 8, 7) },
  { id: FLY, sets: setsOf(20, 12, 12, 12) },
  { id: RUN, target: { mode: 'cardio' }, sets: [{ min: 20, speed: 8, done: true }] },
], { prs: [FLY] })
const BEFORE = [
  saved('g-w0', '2026-10-04', ['g-other'], [{ id: FLY, sets: setsOf(17.5, 12, 12, 12) }], { name: 'Chest' }),
  saved('g-w1', '2026-10-11', ['g-push'], [{ id: BENCH, rid: 'g-push', sets: setsOf(80, 7, 7, 7) }]),
]
const summary = () => <Routes><Route path="/train/workout/summary/:id" element={<SummaryScreen />} /></Routes>
const SUMMARY_PATH = '/train/workout/summary/g-w2'

/* ------------------------------------------------------------------ plays -- */

const ready = { render: () => <ReadyScreen />, path: '/train/workout?start=g-push' }
const route = { render: () => <WorkoutRoute />, path: '/train/workout' }
const today = () => <TodayScreen {...both} />
const open = fn => async tools => { fn(); await tools.wait(250) }
const held = (text, options) => async tools => {
  useUI.getState().toast(text, { ...options, onAction: NOOP })
  useUI.getState().pauseToast()
  await tools.wait(60)
}

registerScreens('Workout: start and finish', [
  { id: 'W1.1', title: 'Ready', note: 'Push A before it starts: the phase bar, Start workout, then Warm-up, Workout and Cool-down.',
    ...ready, mock: { S: store() } },
  { id: 'W1.31', title: 'Warm-up offer', note: 'After Start workout on a session with a warm-up: Start warm-up or Skip warm-up.',
    ...ready, mock: { S: store() }, play: open(() => warmupOfferSheet(['g-push'])) },
  { id: 'W1.40', title: 'Cool-down offer', note: 'Over the running workout once the main work is done: the stretches, Start cool-down or Skip and finish.',
    ...route, mock: { S: store({ active: MAIN_DONE }) }, play: open(cooldownOfferSheet) },
  { id: 'W1.10', title: 'Finish', note: 'Every set ticked: the three tiles, the bests line, Finish and save.',
    ...route, mock: { S: store({ active: ALL_DONE }) }, play: open(finishSheet) },
  { id: 'W1.11', title: 'Finish early', note: 'Sets left: what is left from the data, Finish anyway.',
    ...route, mock: { S: store({ active: SETS_LEFT }) }, play: open(finishSheet) },
  { id: 'W1.46', title: 'Discard workout', note: 'What goes with it and the 8 s Undo on Today.',
    ...route, mock: { S: store({ active: SOME_LOGGED }) }, play: open(discardSheet) },
  { id: 'W1.26', title: 'Discarded', note: 'The toast with Undo for 8 s (held here).',
    render: today, play: held(discardedText('Push A'), { action: t('Undo'), ms: DISCARD_UNDO_MS }) },
  { id: 'W1.27', title: 'Workout left open', note: 'Over Today: started 23 h ago, last set 22 h ago; Save ends it at the last set.',
    render: today, mock: { S: store({ active: LEFT_OPEN }) }, play: open(staleWorkoutSheet) },
  { id: 'W2.0', title: 'Summary', note: 'Push A against the Sunday before: tiles with the delta, New bests, Muscles worked, What you just trained, Cardio, Next time.',
    render: summary, path: SUMMARY_PATH, mock: { S: store({ workouts: [...BEFORE, SAVED] }) } },
  { id: 'W2.1', title: 'Saved', note: 'The toast on Today after Done, with Reopen for 10 s (held here).',
    render: today, play: held(t('Saved {0}', 'Push A'), { action: t('Reopen'), ms: REOPEN_MS }) },
  { id: 'W2.2', title: 'Summary, first time', note: 'The first Push A: no delta, no bests, no next time, and the note says why.',
    render: summary, path: SUMMARY_PATH, mock: { S: store({ workouts: [SAVED] }) } },
])
