import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { MEALS, NOOP, RINGS, TRAINING_ACTIONS, WATER, WEEK, both } from './today-fixture.js'

// Today (PR-01, boards T10Today to T115Over, T1EFood, T1ETraining). Every state is the real
// screen, TodayScreen, given what useToday() would hand it for the board's day (today-fixture.js).
// The drawers and toasts over it are today-drawers.jsx; the variants below are T1.9 to T1.15.

// Nothing eaten yet (T1.9, T1.10): the targets are all left, every pill says so.
const EMPTY_RINGS = [
  { ...RINGS[0], big: '2,100', value: 0, pill: 'Nothing eaten yet' },
  { ...RINGS[1], big: '150', value: 0, pill: 'Nothing yet' },
  { ...RINGS[2], big: '230', value: 0, pill: 'Nothing yet' },
  { ...RINGS[3], big: '70', value: 0, pill: 'Nothing yet' },
]
const EMPTY_MEALS = MEALS.map(m => (m.state === 'done' ? { ...m, state: 'empty', sub: 'Nothing yet' } : m))
const EMPTY_DAY = { rings: EMPTY_RINGS, meals: EMPTY_MEALS, water: { ...WATER, value: 0, label: '0 of 2.5 L' } }
const FIRST_STEPS = {
  label: '1 of 4',
  steps: [
    { title: 'Set your goal', sub: 'Done in onboarding', done: true },
    { title: 'Log your first meal', sub: 'Takes about 20 seconds', onClick: NOOP },
    { title: 'Plan your training week', sub: 'Pick your days in Plan', onClick: NOOP },
    { title: 'Weigh in', sub: 'Starts your trend', onClick: NOOP },
  ],
}
const AWAY = {
  title: 'Welcome back',
  body: '8 days since your last log. Your Plan kept going, so start from today. Nothing to catch up on.',
  actions: [{ label: 'Weigh in', solid: true, onClick: NOOP }, { label: 'Not now', onClick: NOOP }],
}
const withPill = pill => [{ ...RINGS[0], pill }, ...RINGS.slice(1)]
const OVER_RINGS = [
  { ...RINGS[0], top: 'Over today', big: '180', unit: 'kcal over 2,100', value: 2280, over: 180 / 2100, pill: '2,280 eaten' },
  { ...RINGS[1], big: '9', value: 141, pill: '141 g eaten' },
  { ...RINGS[2], top: 'Over today', big: '32', unit: 'g over 230 g', value: 262, over: 32 / 230, pill: '262 g eaten' },
  { ...RINGS[3], top: 'Over today', big: '8', unit: 'g over 70 g', value: 78, over: 8 / 70, pill: '78 g eaten' },
]
const OVER_MEALS = [
  MEALS[0],
  { ...MEALS[1], sub: '980 kcal', state: 'done' },
  { ...MEALS[2], sub: '880 kcal', state: 'done' },
  { ...MEALS[3], sub: 'Nothing yet', state: 'empty' },
]
// 24:18 into the session when the state is opened; the clock runs from there.
const RUNNING = { eyebrow: 'Workout running', since: Date.now() - (24 * 60 + 18) * 1000, title: 'Push A', sub: '3 of 6 exercises done', trailing: 'resume', onClick: NOOP }

registerScreens('Today', [
  { id: 'T1.0', title: 'Today', note: 'Food and training: the rings, the actions, Up next, Food and Water.',
    render: () => <TodayScreen {...both} /> },
  { id: 'T1.1', title: 'Loading', note: 'The diary is still on its way: the ring, the actions and the sections as glass.',
    render: () => <TodayScreen {...both} loading rings={[]} /> },
  { id: 'T1.2', title: 'Protein', note: 'The rings opened on their second page.',
    render: () => <TodayScreen {...both} ring={1} /> },
  { id: 'T1.E-food', title: 'Food-only profile', note: 'No Up next and no Plan; the four food actions stay.',
    render: () => <TodayScreen {...both} profile="food" upNext={null} /> },
  { id: 'T1.E-training', title: 'Training-only profile', note: 'One ring for the week; the week strip replaces Food and Water.',
    render: () => <TodayScreen {...both} profile="training"
      rings={[{ key: 'workouts', name: 'Workouts', icon: 'dumbbell', top: 'This week', big: '2', unit: 'of 4 workouts', value: 2, max: 4, pill: 'Push A today' }]}
      actions={TRAINING_ACTIONS} meals={null} water={null} week={{ days: WEEK, label: '2 of 4 done' }} /> },
  { id: 'T1.9', title: 'First day', note: 'Nothing logged and no Plan: First steps instead of Up next.',
    render: () => <TodayScreen {...both} {...EMPTY_DAY} upNext={null} firstSteps={FIRST_STEPS} /> },
  { id: 'T1.10', title: 'Back after a week away', note: '7+ days since the last log, once per return: the welcome back above the rings.',
    render: () => <TodayScreen {...both} {...EMPTY_DAY} away={AWAY} /> },
  { id: 'T1.11', title: 'Workout running', note: 'Up next is the running session with its clock and Resume. The dot on Train is the app tab bar\'s.',
    render: () => <TodayScreen {...both} upNext={RUNNING} /> },
  { id: 'T1.12', title: 'Workout done', note: 'Until midnight. Burned includes the workout.',
    render: () => <TodayScreen {...both} rings={withPill('640 burned · 860 eaten')}
      upNext={{ eyebrow: 'Done today', title: 'Push A', sub: '52 min · 18 sets · 2 new bests', trailing: 'check', onClick: NOOP }} /> },
  { id: 'T1.13', title: 'Rest day', note: 'No workout in the Plan; Up next names the next one.',
    render: () => <TodayScreen {...both} rings={withPill('860 eaten')}
      upNext={{ eyebrow: 'Rest day', title: 'Recover', sub: 'Next: Legs, tomorrow', trailing: 'chev', onClick: NOOP }} /> },
  { id: 'T1.14', title: 'Offline', note: 'The pill under the header counts the changes waiting, then Saved, Syncing and gone.',
    render: () => <TodayScreen {...both} saved={{ state: 'offline', waiting: 3 }} /> },
  { id: 'T1.15', title: 'Over target', note: 'The ring closes and an amber arc shows how far over.',
    render: () => <TodayScreen {...both} rings={OVER_RINGS} meals={OVER_MEALS} water={{ ...WATER, value: 2, label: '2 of 2.5 L' }} /> },
])
