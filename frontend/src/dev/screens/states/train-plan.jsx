import { EXDB } from '../../../lib/exercises-data.js'
import { isoOf, todayISO } from '../../../lib/format.js'
import PlanScreen from '../../../views/plan/PlanScreen.jsx'
import { registerScreens } from '../registry.js'

// Plan (PR-02 slice 2, boards Tr3Plan, Tr3Changed, Tr3Empty) at /train/schedule. Every state is
// the real screen with its data from a mocked store (mock-env.js keeps a tap's change in memory):
// Push A, Pull A and Legs, Push A logged a week ago, Pull A five days ago. The Coach banner (T3.2)
// is handed in as a prop: the store holds no pending proposal for the page to find (owner
// question 5), so the gallery shows the banner the page draws when one is given.
const NOOP = () => {}
const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return d }
const five = (bp, eq) => EXDB.filter(e => e.bp === bp && e.eq === eq).slice(0, 5)
  .map(e => ({ id: e.id, mode: 'reps', sets: 3, reps: 8, weight: 40 }))
const ROUTINES = [
  { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: five('chest', 'barbell') },
  { id: 'g-pull', name: 'Pull A', emoji: 'dumbbell', ex: five('back', 'cable') },
  { id: 'g-legs', name: 'Legs', emoji: 'dumbbell', ex: five('upper legs', 'barbell') },
]
const logged = (n, r) => {
  const day = daysAgo(n)
  const start = day.getTime()
  return {
    id: 'g-w' + n, d: isoOf(day), start, end: start + 55 * 60000, name: r.name, routineIds: [r.id], prs: [],
    entries: r.ex.map(cfg => ({ id: cfg.id, rid: r.id, target: cfg, sets: [{ w: 40, r: 8, done: true }] })),
  }
}
const base = {
  routines: ROUTINES, dayPlan: {}, dayNotes: {}, missedSeen: {}, active: null, weekStart: 1,
  workouts: [logged(7, ROUTINES[0]), logged(5, ROUTINES[1])],
}
// The loop, this app's own: Push A up next today, then Pull A and Legs, no fixed days beside it.
const LOOP = {
  ...base, week: {}, scheduleMode: 'rotation',
  rotation: { id: 'g-rot', sequence: ['g-push', 'g-pull', 'g-legs'], label: '' },
  queue: { ids: ['g-push', 'g-pull', 'g-legs'], since: daysAgo(0).getTime() - 6 * 3600000, startsOn: todayISO(), label: '', rotationId: 'g-rot' },
}
// The same loop written by a coach's planner: someone else's until adopted.
const EXTERNAL = { ...LOOP, rotation: null, queue: { ...LOOP.queue, rotationId: undefined, label: 'US W1' } }
// A fixed week: Push A Monday and Thursday, Pull A Wednesday, Legs Saturday.
const WEEK = { ...base, week: { 1: ['g-push'], 3: ['g-pull'], 4: ['g-push'], 6: ['g-legs'] }, scheduleMode: 'week', rotation: null, queue: null }
const EMPTY = { ...base, routines: [], workouts: [], week: {}, scheduleMode: 'rotation', rotation: null, queue: null }
const COACH = {
  title: 'Coach suggests 2 changes',
  body: 'Legs to Mon 19 because Fri was missed, and Pull A to Wed 21 to keep two rest days before Legs. Nothing moves until you apply.',
  onReview: NOOP, onDismiss: NOOP,
}
const plan = () => <PlanScreen />

registerScreens('Train: plan', [
  { id: 'T3.0', title: 'Plan', note: 'The loop with Push A up next, the round, the two weeks and the weekly volume.',
    path: '/train/schedule', render: plan, mock: { S: LOOP } },
  { id: 'T3.0w', title: 'Plan, Fixed week', note: 'Owner question 1: the same page on a fixed week; tap a day to change it.',
    path: '/train/schedule', render: plan, mock: { S: WEEK } },
  { id: 'T3.0x', title: 'Plan, someone else’s loop', note: 'A coach’s planner wrote the pass: no switch, no Edit; Use this rotation adopts it.',
    path: '/train/schedule', render: plan, mock: { S: EXTERNAL } },
  { id: 'T3.0e', title: 'Plan, editing the loop', note: 'Edit open: take one out (with Undo), move it, drag it, add one.',
    path: '/train/schedule', render: plan, mock: { S: LOOP }, play: async t => { await t.click('Edit') } },
  { id: 'T3.2', title: 'Coach changed the plan', note: 'The banner with Review and Dismiss (handed in: no proposal is stored for the page).',
    path: '/train/schedule', render: () => <PlanScreen coach={COACH} />, mock: { S: LOOP } },
  { id: 'T3.3', title: 'Nothing planned', note: 'No routines: the two ways in, and no muscle volume.',
    path: '/train/schedule', render: plan, mock: { S: EMPTY } },
])
