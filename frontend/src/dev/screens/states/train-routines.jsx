import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { EXDB } from '../../../lib/exercises.js'
import { exerciseNameText } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import RoutineEditor from '../../../views/routines/RoutineEditor.jsx'
import RoutinesScreen from '../../../views/routines/RoutinesScreen.jsx'
import { deletedText } from '../../../views/routines/routine-actions.js'
import { registerScreens } from '../registry.js'

// Train › Routines (boards Tr4Routines, Tr4Empty, Tr4Deleted, Tr4Imported). Every state is the
// real screen over a mocked store (mock-env.js keeps every change in memory): Push A on Sunday
// and Thursday, Pull A on Wednesday, Legs on Monday and Saturday; Upper A from a plan file, and
// Arms never trained. The board's "imported from Dan" reads the plan's name (owner question 4).

const ex = ids => ids.map(id => ({ id, mode: 'reps', sets: 3, reps: 8, weight: 40 }))
const PUSH = ex(['0025', '0314', '0426', '0188', '0334', '0201'])
const PULL = ex(['0861', '0652', '0027', '0188', '0334', '0201'])
const LEGS = ex(['0043', '0085', '0739', '0585', '0586', '0594'])
export const ROUTINES = [
  { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: PUSH },
  { id: 'g-pull', name: 'Pull A', emoji: 'dumbbell', ex: PULL },
  { id: 'g-legs', name: 'Legs', emoji: 'dumbbell', ex: LEGS },
  { id: 'g-upper', name: 'Upper A', emoji: 'dumbbell', ex: ex(['0025', '0861', '0426', '0652', '0334', '0201', '0027']), importedFrom: 'Upper Lower' },
  { id: 'g-arms', name: 'Arms', emoji: 'dumbbell', ex: ex(['0201', '0027', '0334', '0188', '0314']) },
]
const trained = id => ({ id: 'g-w-' + id, d: '2026-10-14', start: 1, end: 2, name: id, routineIds: [id], entries: [], prs: [] })
export const routinesPlan = (over = {}) => ({
  weekStart: 0,
  // The editor backs up on the way out (useStore autoBackupNow) on a phone with the setting on.
  autoBackup: false,
  routines: ROUTINES,
  week: { 0: ['g-push'], 4: ['g-push'], 3: ['g-pull'], 1: ['g-legs'], 6: ['g-legs'] },
  dayPlan: {}, queue: null, rotation: null, scheduleMode: 'week', active: null,
  workouts: ['g-push', 'g-pull', 'g-legs'].map(trained),
  ...over,
})

// The four routines a plan import added (T4.4), and the landing state the import navigates with.
const IMPORTED = [
  { id: 'g-ua', name: 'Upper A', ex: ex(['0025', '0861', '0426', '0652', '0334', '0201', '0027']) },
  { id: 'g-la', name: 'Lower A', ex: LEGS },
  { id: 'g-ub', name: 'Upper B', ex: ex(['0314', '0652', '0426', '0861', '0188', '0201', '0027']) },
  { id: 'g-lb', name: 'Lower B', ex: LEGS },
].map(r => ({ ...r, emoji: 'dumbbell', importedFrom: 'Upper Lower' }))

// Lands on the page the way a plan import does: navigation state, not a prop.
function Landing({ state }) {
  const nav = useNavigate()
  const here = useLocation()
  const landed = !!here.state
  useEffect(() => { if (!landed) nav('/train/routines', { state, replace: true }) }, [landed, nav, state])
  return landed ? <RoutinesScreen /> : null
}
const LANDING = { imported: { ids: IMPORTED.map(r => r.id), from: 'Upper Lower' } }

// The toast held open, as a person's finger would hold it.
const held = text => async t => {
  useUI.getState().toast(text, { action: 'Undo', onAction: () => {} })
  useUI.getState().pauseToast()
  await t.wait(60)
}

// The editor's page, as App.jsx routes it.
const editor = () => <Routes><Route path="/train/routines/:id" element={<RoutineEditor />} /></Routes>
const tr = t
// A cable fly, for T5.4's "Added Cable standing fly to Push A".
const FLY = EXDB.find(e => /cable/i.test(e.n) && /fly/i.test(e.n)) || EXDB[0]
// Push A as the board draws it: rows with a double-progression range and a step, and the last two a
// superset with 90 s rest after both; Push A's last workout took 55 minutes.
const PUSH_BOARD = [
  { id: '0025', mode: 'reps', sets: 4, reps: 8, repsMin: 6, weight: 80, prog: 'double', inc: 2.5 },
  { id: '0314', mode: 'reps', sets: 3, reps: 10, repsMin: 8, weight: 26, prog: 'double', inc: 2 },
  { id: '0426', mode: 'reps', sets: 3, reps: 12, weight: 14, inc: 1 },
  { id: '0188', mode: 'reps', sets: 3, reps: 12, weight: 20, inc: 2.5 },
  { id: '0334', mode: 'reps', sets: 3, reps: 12, weight: 25, inc: 2.5, sg: 'g-ss', sgRest: 90 },
  { id: '0201', mode: 'reps', sets: 3, reps: 15, weight: 0, sg: 'g-ss', sgRest: 90 },
]
function editorPlan({ added = false, extra = [] } = {}) {
  const base = routinesPlan()
  const push = { ...ROUTINES[0], ex: added ? [...PUSH_BOARD, { id: FLY.id, mode: 'reps', sets: 3, reps: 10, weight: 0 }] : PUSH_BOARD }
  const timed = base.workouts.map(w => (w.routineIds[0] === 'g-push' ? { ...w, start: 1, end: 1 + 55 * 60000 } : w))
  return { ...base, routines: [push, ...ROUTINES.slice(1), ...extra], workouts: timed }
}

const withoutPush = () => {
  const full = routinesPlan()
  return { ...full, routines: full.routines.filter(r => r.id !== 'g-push'), week: { 3: ['g-pull'], 1: ['g-legs'], 6: ['g-legs'] } }
}

registerScreens('Train: routines', [
  { id: 'T4.0', title: 'Routines', note: 'In your Plan, Not in your Plan (imported, not done yet) and Freestyle; Reorder on the first group.',
    path: '/train/routines', render: () => <RoutinesScreen />, mock: { S: routinesPlan() } },
  { id: 'T4.1', title: 'No routines yet', note: 'New routine and Pick a ready-made plan.',
    path: '/train/routines', render: () => <RoutinesScreen />, mock: { S: routinesPlan({ routines: [], week: {}, workouts: [] }) } },
  { id: 'T4.3', title: 'Routine deleted', note: 'Push A swiped away: its toast names the days that became rest, with Undo (held here).',
    path: '/train/routines', render: () => <RoutinesScreen />, mock: { S: withoutPush() },
    play: held(deletedText(routinesPlan(), 'g-push')) },
  { id: 'T4.4', title: 'Added from a plan file', note: 'The landing after an import: its routines first, each new. Plan M3 raises the toast.',
    path: '/train/routines', render: () => <Landing state={LANDING} />,
    mock: { S: routinesPlan({ routines: [...ROUTINES, ...IMPORTED] }) } },
  // The routine editor (T5.0 and its edges, T5.4, T5.6): the real page over the same plan, with the
  // board's numbers. Every tap stays in memory (mock-env.js swaps `update`), and the one play that
  // touches the store's sync state (Offline) has it put back with the rest of the mocks.
  { id: 'T5.0', title: 'Routine', note: 'Push A: in your Plan Sun and Thu, saved, the muscles on the map, the rows with their progression lines, a superset with its rest, Add exercise and Start.',
    path: '/train/routines/g-push', render: editor, mock: { S: editorPlan() } },
  { id: 'T5.0-pull', title: 'Routine, Pull A', note: 'The same page for Pull A (Wednesday).',
    path: '/train/routines/g-pull', render: editor, mock: { S: editorPlan() } },
  { id: 'T5.0-legs', title: 'Routine, Legs', note: 'The same page for Legs (Monday and Saturday).',
    path: '/train/routines/g-legs', render: editor, mock: { S: editorPlan() } },
  { id: 'T5.0-reorder', title: 'Routine, Reorder', note: 'Reorder: move buttons and a grip on every row; a long press or the grip drags, a superset whole.',
    path: '/train/routines/g-push', render: editor, mock: { S: editorPlan() },
    play: async t => { [...document.querySelectorAll('.g-ssec-act')].find(b => b.textContent === tr('Reorder'))?.click(); await t.wait(60) } },
  { id: 'T5.0-offline', title: 'Routine, offline', note: 'Edits save on the phone; the pill says Offline. The store keeps no count of the changes waiting, so none is said.',
    path: '/train/routines/g-push', render: editor, mock: { S: editorPlan() },
    play: async t => { useStore.setState(s => ({ sync: { ...s.sync, offline: true, pending: true, status: 'offline' } })); await t.wait(60) } },
  { id: 'T5.4', title: 'Exercise added', note: 'Back in the editor with the new row, and the toast naming it, with Undo (held here).',
    path: '/train/routines/g-push', render: editor, mock: { S: editorPlan({ added: true }) },
    play: held(tr('Added {0} to {1}', exerciseNameText(FLY), 'Push A')) },
  { id: 'T5.6', title: 'New routine', note: 'Just made: the name focused and selected, “Nothing in it yet” and Add exercises. The first edit drops ?new=1.',
    path: '/train/routines/g-new?new=1', render: editor,
    mock: { S: editorPlan({ extra: [{ id: 'g-new', name: 'New routine', emoji: 'dumbbell', ex: [] }] }) } },
])
