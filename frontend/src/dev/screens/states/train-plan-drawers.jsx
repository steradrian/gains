import { EXDB } from '../../../lib/exercises-data.js'
import { DAYN, isoOf, todayISO } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { parsePlan } from '../../../lib/plan-share.js'
import { dayNoteSheet, dayOverrideSheet, planShareSheet, planToolsSheet } from '../../../sheets.jsx'
import PlanScreen from '../../../views/plan/PlanScreen.jsx'
import PlanImportPage from '../../../views/plan-import/PlanImportPage.jsx'
import { registerScreens } from '../registry.js'

// The Plan page's drawers (T3.1 Plan day, T3.4 Day note, T3.5 Plan menu, T3.6 Share), each the
// real one opened the way the page opens it, over the route App.jsx renders for /train/schedule;
// T3.7 Import a plan (a page of its own); T4.4, the Routines page it lands on with its toast, is in
// train-routines.jsx. The plan in
// the mocked store is the boards': Push A, Pull A and Legs on their weekdays, Pull A logged four
// days ago, Legs missed two days ago. Every tap changes memory only (mock-env.js stubs update).
const day = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() + n); return d }
const three = (bp, eq) => EXDB.filter(e => e.bp === bp && e.eq === eq).slice(0, 3)
  .map(e => ({ id: e.id, mode: 'reps', sets: 3, reps: 8, weight: 40 }))
const ROUTINES = [
  { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: three('chest', 'barbell') },
  { id: 'g-pull', name: 'Pull A', emoji: 'dumbbell', ex: three('back', 'cable') },
  { id: 'g-legs', name: 'Legs', emoji: 'dumbbell', ex: three('upper legs', 'barbell') },
]
const pulled = () => {
  const d = day(-4)
  const start = d.getTime()
  return {
    id: 'g-w1', d: isoOf(d), start, end: start + 50 * 60000, name: 'Pull A', routineIds: ['g-pull'], prs: [],
    entries: ROUTINES[1].ex.map(cfg => ({ id: cfg.id, rid: 'g-pull', target: cfg, sets: [{ w: 40, r: 8, done: true }] })),
  }
}
const plan = (over = {}) => ({
  routines: ROUTINES,
  week: { [day(0).getDay()]: ['g-push'], [day(2).getDay()]: ['g-pull'], [day(-2).getDay()]: ['g-legs'], [day(-4).getDay()]: ['g-pull'] },
  dayPlan: {}, dayNotes: {}, missedSeen: {}, queue: null, active: null, workouts: [pulled()],
  ...over,
})
// A friend's file, as parsePlan hands it to the page: four routines, four days a week.
const FILE = parsePlan({
  opengym_plan: 1, unit: 'kg', name: 'Upper Lower',
  routines: [
    { id: 'ua', name: 'Upper A', ex: [...three('chest', 'barbell'), ...three('back', 'cable')].slice(0, 5) },
    { id: 'la', name: 'Lower A', ex: three('upper legs', 'barbell') },
    { id: 'ub', name: 'Upper B', ex: [...three('back', 'cable'), ...three('chest', 'barbell')].slice(0, 5) },
    { id: 'lb', name: 'Lower B', ex: three('upper legs', 'barbell').reverse() },
  ],
  week: { 1: ['ua'], 2: ['la'], 4: ['ub'], 5: ['lb'] },
  customEx: [],
}, 'kg')

const planPage = () => <PlanScreen />
const open = fn => async tools => { fn(); await tools.wait(200) }
const ahead = isoOf(day(2))
const missed = isoOf(day(-2))
const note = { [todayISO()]: { tag: 'injured', text: 'Shoulder felt tight on Wednesday. Go lighter on overhead work.', _ts: 1 } }

registerScreens('Train: plan drawers', [
  { id: 'T3.1', title: 'Plan day, only this date', note: 'Pick one routine for the date; Rest moves it to the next free day.', render: planPage,
    mock: { S: plan() }, play: open(() => dayOverrideSheet(ahead)) },
  { id: 'T3.1e', title: 'Plan day, every weekday', note: 'One or more routines for the weekday, in the order tapped.', render: planPage,
    mock: { S: plan() }, play: async tools => {
      dayOverrideSheet(ahead)
      await tools.wait(200)
      await tools.click(t('Every {0}', t(DAYN[day(2).getDay()])))
    } },
  { id: 'T3.1p', title: 'Plan day, a missed day gone by', note: 'Log this workout, and the note; no scope.', render: planPage,
    mock: { S: plan() }, play: open(() => dayOverrideSheet(missed)) },
  { id: 'T3.4', title: 'Day note', note: 'Four quick tags and a line of text; Remove note when there is one.', render: planPage,
    mock: { S: plan({ dayNotes: note }) }, play: open(() => dayNoteSheet(todayISO())) },
  { id: 'T3.5', title: 'Plan menu', note: 'Coach shows only when the coach is on.', render: planPage,
    mock: { S: plan() }, play: open(planToolsSheet) },
  { id: 'T3.6', title: 'Share your plan', render: planPage, mock: { S: plan() }, play: open(planShareSheet) },
  { id: 'T3.7', title: 'Import a plan', note: 'The plan’s name in place of the sender’s.', path: '/train/schedule/import',
    render: () => <PlanImportPage bundle={FILE} />, mock: { S: plan() } },
  { id: 'T3.7e', title: 'Import a plan, unreadable file', note: 'Nothing changed; Choose another file.', path: '/train/schedule/import',
    render: () => <PlanImportPage error="" />, mock: { S: plan() } },
])
