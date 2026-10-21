import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUI } from '../../../store/useUI.js'
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
])
