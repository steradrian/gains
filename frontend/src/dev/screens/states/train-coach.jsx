import { dumbbellInventorySheet, equipmentProfileSheet, plateInventorySheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import GymSetup from '../../../views/train/gym/GymSetup.jsx'
import PlanPreview from '../../../views/train/plans/PlanPreview.jsx'
import PlansScreen from '../../../views/train/plans/PlansScreen.jsx'
import { registerScreens } from '../registry.js'

// Train slice 6, plans and gym (PR-02): Ready-made plans (T10.0), a plan's preview (T10.1, fitted
// and with no profile), the toast after Load (T10.2), Gym setup (T12.0) and its drawers (T12.1 the
// profile, new and editing, and the plates and dumbbells drawers T12.0 opens). Every state is the
// real page or drawer on a mocked store: Load, Undo, a count and a delete stay in memory
// (installMocks), and nothing here is saved. Coach is on for the plans list, as the boards draw it.
const ALEX = { id: 'u1', name: 'Alex' }
const COACH = { config: { coach: { enabled: true } }, user: ALEX }

const HOME = { id: 'home', name: 'Home gym', equipment: ['dumbbell', 'bench', 'body weight'], accV: 1 }
const CITY = { id: 'city', name: 'City Gym', equipment: ['barbell', 'dumbbell', 'cable', 'leverage machine', 'sled machine', 'bench', 'pull-up bar'], accV: 1 }
const lift = id => ({ id, sets: 3, reps: 8, weight: 0 })
// What is on the Plan now, so the preview has something to say it replaces
const ROUTINES = [
  { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: [lift('0025'), lift('0314')] },
  { id: 'g-pull', name: 'Pull A', emoji: 'dumbbell', ex: [lift('0861')] },
  { id: 'g-legs', name: 'Legs', emoji: 'dumbbell', ex: [lift('0043')] },
]
const PLAN = { routines: ROUTINES, week: { 1: ['g-push'], 3: ['g-pull'], 5: ['g-legs'] }, dayPlan: {}, active: null, queue: null, scheduleMode: null, unit: 'kg' }
const GEAR = {
  unit: 'kg',
  equipProfiles: [HOME, CITY],
  activeEquipId: 'home',
  equipFilterOn: true,
  plates: { kg: { 25: 2, 20: 4, 15: 2, 10: 4, 5: 4, 2.5: 4, 1.25: 2, _ts: 1 } },
  dumbbells: { kg: { weights: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25, 27.5, 30, 32.5], _ts: 1 } },
}

const fitted = { ...PLAN, ...GEAR }
const unfitted = { ...PLAN, equipProfiles: [], activeEquipId: null, equipFilterOn: false }
const open = fn => async t => { fn(); await t.wait(200) }

registerScreens('Train slice 6', [
  { id: 'T10.0', title: 'Ready-made plans', note: 'Four starters, then Import a plan file and Ask Coach (Coach on).',
    render: () => <PlansScreen />, mock: { ...COACH, S: unfitted } },
  { id: 'T10.0n', title: 'Ready-made plans, Coach off', note: 'The Ask Coach row is not drawn.',
    render: () => <PlansScreen />, mock: { S: unfitted } },
  { id: 'T10.1', title: 'Plan preview, fitted', note: 'Fitted to Home gym (the profile the library is filtered by): the swaps, the week, what it replaces.',
    render: () => <PlanPreview id="ppl" />, mock: { S: fitted } },
  { id: 'T10.1e', title: 'Plan preview, no equipment profile', note: 'Fit to my equipment is off and says why; the way to Gym setup is the line.',
    render: () => <PlanPreview id="upper-lower" />, mock: { S: unfitted } },
  { id: 'T10.2', title: 'Plan loaded', note: 'Load, played for real on the mocked store: the toast with Undo for 8 s (held here). Slice 2\'s Plan is behind it in the app.',
    render: () => <PlanPreview id="upper-lower" />, mock: { S: unfitted },
    play: async t => { await t.click('Load Upper / Lower'); useUI.getState().pauseToast(); await t.wait(60) } },
  { id: 'T12.0', title: 'Gym setup', note: 'Profile chips with + New, Filter by equipment, the plates and the dumbbells (both for every profile).',
    render: () => <GymSetup />, mock: { S: GEAR } },
  { id: 'T12.0e', title: 'Gym setup, no profile', note: 'Only + New; the standard plates and no dumbbells listed.',
    render: () => <GymSetup />, mock: { S: { unit: 'kg', equipProfiles: [], activeEquipId: null, equipFilterOn: false, plates: {}, dumbbells: {} } } },
  { id: 'T12.0p', title: 'Plates drawer', note: 'One stepper a size, in pairs; Back to the standard set once the list is your own.',
    render: () => <GymSetup />, mock: { S: GEAR }, play: open(plateInventorySheet) },
  { id: 'T12.0d', title: 'Dumbbells drawer', note: 'The bells you own, one row each, add one, fill the usual rack or clear the list.',
    render: () => <GymSetup />, mock: { S: GEAR }, play: open(dumbbellInventorySheet) },
  { id: 'T12.1', title: 'New equipment profile', note: 'A name and the equipment types; Save.',
    render: () => <GymSetup />, mock: { S: GEAR }, play: open(() => equipmentProfileSheet(null)) },
  { id: 'T12.1e', title: 'Edit profile', note: 'Delete profile is a row at the end: it deletes at once and the toast offers Undo.',
    render: () => <GymSetup />, mock: { S: GEAR }, play: open(() => equipmentProfileSheet(HOME)) },
])
