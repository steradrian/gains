import { Route, Routes } from 'react-router-dom'
import { planDaysSheet, routineMenuSheet, routineSettingsSheet, shareRoutineSheet } from '../../../sheets.jsx'
import RoutineEdit from '../../../views/RoutineEdit.jsx'
import { registerScreens } from '../registry.js'
import { routinesPlan } from './train-routines.jsx'

// T5.8, Push A's menu, and the drawers it opens (Plan days, Share routine, Routine settings), each
// the real one opened the way the editor's ⋯ opens it, over the routine's page: whatever App.jsx
// routes /train/routines/:id to (the editor), imported the way App.jsx imports it.
const PATH = '/train/routines/g-push'
const editor = () => <Routes><Route path="/train/routines/:id" element={<RoutineEdit />} /></Routes>
const open = fn => async t => { fn(); await t.wait(200) }

registerScreens('Train: routines drawers', [
  { id: 'T5.8', title: 'Routine menu', note: 'Start, Plan days, Duplicate, Share, Routine settings (owner question 8), Delete with Undo.',
    path: PATH, render: editor, mock: { S: routinesPlan() }, play: open(() => routineMenuSheet('g-push')) },
  { id: 'T5.8-days', title: 'Plan days', note: 'Seven weekdays in the week’s order; Save puts Push A on exactly those, with Undo.',
    path: PATH, render: editor, mock: { S: routinesPlan() }, play: open(() => planDaysSheet('g-push')) },
  { id: 'T5.8-share', title: 'Share routine', note: 'As a plan file, or Print / Save as PDF.',
    path: PATH, render: editor, mock: { S: routinesPlan() }, play: open(() => shareRoutineSheet('g-push')) },
  { id: 'T5.8-settings', title: 'Routine settings', note: 'The icon, Deload and the progression, moved from the editor.',
    path: PATH, render: editor, mock: { S: routinesPlan() }, play: open(() => routineSettingsSheet('g-push')) },
])
