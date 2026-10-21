import { isoOf } from '../../../lib/format.js'
import { useUI } from '../../../store/useUI.js'
import TrainScreen from '../../../views/train/TrainScreen.jsx'
import { pictureOf } from '../../../views/train/use-train.js'
import { registerScreens } from '../registry.js'

// Train (PR-02, boards Tr2Train to Tr2Future). Every state is the real screen, TrainScreen, given
// what useTrain() would hand it on the boards' day, Sunday 18 October 2026: Push A today, Legs on
// Monday and Friday, Pull A on Wednesday. The toasts (T2.12, T2.13) are the app's real toast,
// held open. The drawers over T2.0 (T2.1, T2.2) are train-drawers.jsx, which takes `base` from here.

const NOOP = () => {}
const TODAY = '2026-10-18'
const pic = id => pictureOf({}, id)
const PUSH = [['0025', 'Barbell bench press'], ['0314', 'Dumbbell incline bench press'], ['0426', 'Dumbbell standing overhead press'], ['0188', 'Cable middle fly'], ['0334', 'Dumbbell lateral raise'], ['0201', 'Cable pushdown']]
const LEGS = [['0043', 'Barbell full squat', '4 × 5 · 100 kg'], ['0085', 'Barbell romanian deadlift', '3 × 8 · 90 kg'], ['0739', 'Sled 45° leg press', '3 × 10–12 · 160 kg'],
  ['0585', 'Lever leg extension', '3 × 12 · 45 kg'], ['0586', 'Lever lying leg curl', '3 × 12 · 40 kg'], ['0594', 'Lever seated calf raise', '4 × 15 · 35 kg']]
const PULL = ['0861', '0652', '0027']
const exercises = list => list.map(([id, name, line = '3 × 10']) => ({ id, name, line, image: pic(id) }))

/* ------------------------------------------------------------------ the rail -- */

// The weekly plan by weekday (0 is Sunday): Push A, Legs, Pull A, Legs.
const PLAN = { 0: 'Push A', 1: 'Legs', 3: 'Pull A', 5: 'Legs' }
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const dayOf = (iso, missed) => {
  const d = new Date(iso + 'T12:00:00')
  const name = PLAN[d.getDay()] || null
  const state = iso === TODAY ? 'today' : iso === missed ? 'missed' : iso < TODAY ? (name ? 'done' : 'rest') : name ? 'planned' : 'rest'
  const long = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return { iso, dow: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), date: d.getDate(), state, name, label: long + ', ' + (name || 'Rest day') }
}
// Weeks run Thursday to Wednesday with today fourth; two weeks back, eight ahead.
const railOf = missed => ({
  from: -2,
  to: 8,
  weeks: Array.from({ length: 11 }, (_, k) => {
    const offset = k - 2
    const start = plusDays(TODAY, offset * 7 - 3)
    const title = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : 'Week of ' + new Date(start + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return { offset, title, start, days: Array.from({ length: 7 }, (_, i) => dayOf(plusDays(start, i), missed)) }
  }),
})

/* ----------------------------------------------------------------- the cards -- */

const CARD = { since: null, progress: null, chip: null, exercises: null, thumbs: null, primary: null, secondary: [], menu: [] }
const PLANNED = {
  ...CARD, kind: 'planned', iso: TODAY, eyebrow: 'Today · planned', title: 'Push A', sub: 'Chest, shoulders, triceps · 6 exercises · about 55 min',
  exercises: exercises(PUSH), primary: { intent: 'start', label: 'Start Push A', ids: ['push'] }, menu: [{ intent: 'choose-workout' }],
}
const RUNNING = {
  ...CARD, kind: 'running', iso: TODAY, eyebrow: 'In progress', since: Date.now() - (24 * 60 + 18) * 1000, title: 'Push A',
  sub: '3 of 6 exercises · 11 sets · next: Cable middle fly', progress: 0.5, primary: { intent: 'resume', label: 'Resume' },
}
const DONE = {
  ...CARD, kind: 'done', iso: TODAY, eyebrow: 'Workout done', title: 'Push A', sub: '52 min · 18 sets · 9,600 kg · 2 new bests',
  thumbs: PUSH.map(([id]) => pic(id)), primary: { intent: 'see-workout', label: 'See workout', workouts: [] }, menu: [{ intent: 'change-day' }],
}
const REST = {
  ...CARD, kind: 'rest', iso: TODAY, eyebrow: 'Rest day', title: 'Recover', sub: 'Next: Legs, Mon 19 Oct',
  primary: { intent: 'train-anyway', label: 'Train anyway' }, secondary: [{ intent: 'see-day', label: 'See Monday', iso: '2026-10-19' }], menu: [{ intent: 'change-day' }],
}
const UPCOMING = {
  ...CARD, kind: 'upcoming', iso: '2026-10-19', eyebrow: 'Mon 19 Oct · planned', title: 'Legs', sub: 'Quads, hamstrings, calves · 6 exercises · about 60 min',
  exercises: exercises(LEGS), secondary: [{ intent: 'change-day', label: 'Change this day' }, { intent: 'see-routine', label: 'See routine' }],
}
const FUTURE = {
  ...CARD, kind: 'future', iso: '2026-10-24', eyebrow: 'Sat 24 Oct', chip: 'Planned', title: 'Legs', sub: '6 exercises · about 60 min · read-only until the day',
  exercises: exercises(LEGS), secondary: [{ intent: 'change-day', label: 'Change this day' }, { intent: 'see-routine', label: 'Edit routine' }],
}

/* -------------------------------------------------------------- the screen -- */

export const base = {
  header: { initial: 'Alex', placeholder: 'Search training', onSettings: NOOP, onBell: NOOP, onSearch: NOOP },
  searching: false,
  selected: TODAY,
  select: NOOP,
  rail: railOf(null),
  card: () => PLANNED,
  rings: [
    { key: 'workouts', name: 'Workouts', icon: 'dumbbell', top: 'This week', big: 2, unit: 'of 4 workouts', value: 2, max: 4, pill: 'Push A today' },
    { key: 'volume', name: 'Volume', icon: 'chartLine', top: 'Volume this week', big: '14.3', unit: 't of 18.9 t last week', value: 14.3, max: 18.9, pill: 'Bench press best: 82.5 kg' },
    { key: 'streak', name: 'Streak', icon: 'flame', top: 'On plan', big: '6', unit: 'weeks in a row', value: 6, max: 8, pill: 'Best: 8 weeks' },
  ],
  onRing: NOOP,
  actions: [
    { key: 'start', icon: 'play', label: 'Start', onClick: NOOP },
    { key: 'plan', icon: 'calendar', label: 'Plan', onClick: NOOP },
    { key: 'routines', icon: 'list', label: 'Routines', onClick: NOOP },
    { key: 'exercises', icon: 'bookOpen', label: 'Exercises', onClick: NOOP },
  ],
  onIntent: NOOP,
  onPlan: NOOP,
  onDayMenu: NOOP,
  routines: [
    { id: 'push', name: 'Push A', sub: '6 exercises · Sun', thumbs: PUSH.slice(0, 3).map(([id]) => pic(id)) },
    { id: 'pull', name: 'Pull A', sub: '6 exercises · Wed', thumbs: PULL.map(pic) },
    { id: 'legs', name: 'Legs', sub: '6 exercises · Mon', thumbs: LEGS.slice(0, 3).map(([id]) => pic(id)) },
    { id: null, name: 'Freestyle', sub: 'Pick exercises as you go', thumbs: [], freestyle: true },
  ],
  onRoutine: NOOP,
  onRoutineStart: NOOP,
  musclesThisWeek: { title: 'Week of 12 Oct', levels: { chest: 4, deltoids: 3, triceps: 3, 'upper-back': 2, biceps: 2, trapezius: 1, abs: 1 }, note: 'Legs not trained yet' },
  onMuscles: NOOP,
  more: [
    { key: 'history', title: 'History', sub: '24 workouts · last: Wed 14 Oct' },
    { key: 'load', title: 'Training load', sub: 'Activity, muscle balance, fatigue, strength' },
    { key: 'coach', title: 'Coach', sub: '3 suggestions this week' },
    { key: 'plans', title: 'Ready-made plans', sub: 'Full Body, Push / Pull / Legs, Upper / Lower, 5×5' },
    { key: 'gym', title: 'Gym setup', sub: 'Home gym' },
  ],
  onMore: NOOP,
  profile: { kind: 'on' },
  setup: { onPlans: NOOP, onRoutine: NOOP, onImport: NOOP },
  missed: null,
}
const MISSED = {
  title: 'You missed Legs on Fri 16 Oct', body: 'Coach suggests doing it today; Push A would move to Tue 20 Oct. Nothing changes until you choose.',
  moveLabel: 'Move to today', skipLabel: 'Skip it', onMove: NOOP, onSkip: NOOP,
}
const OFF = {
  kind: 'off',
  activities: [
    { icon: 'figureRun', title: 'Run', sub: 'Sat 17 Oct · 32 min · 5.2 km' },
    { icon: 'bike', title: 'Cycling', sub: 'Thu 15 Oct · 1 h 10' },
    { icon: 'steps', title: 'Walk', sub: 'Tue 13 Oct · 58 min' },
  ],
}
// The toast held open, as a person's finger would hold it.
const held = text => async t => {
  useUI.getState().toast(text, { action: 'Undo', onAction: NOOP })
  useUI.getState().pauseToast()
  await t.wait(60)
}

registerScreens('Train', [
  { id: 'T2.0', title: 'Train', note: 'Push A today: the rail, the rings, the actions, the card, Routines and Your training.',
    render: () => <TrainScreen {...base} /> },
  { id: 'T2.3', title: 'A planned day this week', note: 'Monday picked in the rail: read-only, Change this day and See routine.',
    render: () => <TrainScreen {...base} selected="2026-10-19" card={() => UPCOMING} /> },
  { id: 'T2.7', title: 'Workout running', note: 'The clock, the bar and Resume; the dot on Train is the app tab bar\'s.',
    render: () => <TrainScreen {...base} card={() => RUNNING}
      rings={[{ ...base.rings[0], pill: 'Push A running' }, ...base.rings.slice(1)]} /> },
  { id: 'T2.8', title: 'Missed a planned day', note: 'Friday\'s Legs not logged: Move to today or Skip it, above the rings.',
    render: () => <TrainScreen {...base} rail={railOf('2026-10-16')} missed={MISSED} /> },
  { id: 'T2.9', title: 'Training not set up', note: 'No routines, plan or workouts: the week\'s other activities, then three ways in.',
    render: () => <TrainScreen {...base} profile={OFF} /> },
  { id: 'T2.10', title: 'Done today', note: 'The session\'s line and See workout, until midnight.',
    render: () => <TrainScreen {...base} card={() => DONE} /> },
  { id: 'T2.11', title: 'Rest day', note: 'Recover, the next session, Train anyway and See Monday.',
    render: () => <TrainScreen {...base} card={() => REST} /> },
  { id: 'T2.12', title: 'Moved to today', note: 'The toast with Undo for 8 s (held here).',
    render: () => <TrainScreen {...base} card={() => ({ ...PLANNED, title: 'Legs', primary: { intent: 'start', label: 'Start Legs', ids: ['legs'] } })} />,
    play: held('Moved Legs to today. Push A is now Tue 20 Oct') },
  { id: 'T2.13', title: 'Skipped', note: 'The toast with Undo for 8 s (held here).',
    render: () => <TrainScreen {...base} />, play: held('Skipped Legs on Fri 16 Oct. Push A stays today') },
  { id: 'T2.14', title: 'A later week', note: 'Saturday next week: the list of what is in it, Change this day and Edit routine.',
    render: () => <TrainScreen {...base} selected="2026-10-24" card={() => FUTURE} /> },
])
