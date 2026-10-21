import { useLocation } from 'react-router-dom'
import { CONSENT_VERSION } from '../../../lib/coach.js'
import { checkInWeek } from '../../../lib/coach-checkin.js'
import { t, tn } from '../../../lib/i18n.js'
import { dumbbellInventorySheet, equipmentProfileSheet, plateInventorySheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import CoachChat from '../../../views/CoachChat.jsx'
import TrainHub from '../../../views/TrainHub.jsx'
import { checkInSheet } from '../../../views/train/coach/CheckInDrawer.jsx'
import GymSetup from '../../../views/train/gym/GymSetup.jsx'
import PlanPreview from '../../../views/train/plans/PlanPreview.jsx'
import PlansScreen from '../../../views/train/plans/PlansScreen.jsx'
import { registerScreens } from '../registry.js'

// Train slice 6, plans, Coach and gym (PR-02). The Coach page and its check-in and toasts (T11.x)
// are at the end, after Ready-made plans (T10.0), a plan's preview (T10.1, fitted
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

// The Coach page (T11.0 to T11.3). Coach is on and set up; the thread is the boards'. The status
// poll is answered by the mocked /api (installMocks), so nothing reaches a Coach: a request is a
// 404 the page toasts, and an apply stays in the mocked store. The two toasts are shown as they
// read, with an Undo that does nothing: a real Dismiss would commit after 8 s, perhaps after this
// state has handed the real store back.
const at = (h, m) => new Date(2026, 9, 19, h, m).getTime()
const COACHED = {
  ...PLAN,
  workouts: [],
  coach: {
    consent: { agreedAt: '2026-07-01T00:00:00Z', version: CONSENT_VERSION },
    profile: { goal: 'muscle', experience: 'some', daysPerWeek: 4, sessionMin: 60, preferredDays: [1, 3, 5, 6], equipment: [] },
    log: [], snapshots: [], timings: [],
    chat: [
      { id: 'c1', role: 'user', kind: 'intake', at: at(9, 2) },
      { id: 'c2', role: 'coach', kind: 'text', text: 'Friday’s Legs didn’t happen. Want me to move it to Monday and push Pull A to Wednesday? Your squat is due a heavier week: 102.5 kg × 5.', at: at(9, 40) },
      { id: 'c3', role: 'user', kind: 'text', text: 'Can we keep Sunday free from now on?', at: at(9, 41) },
      { id: 'c4', role: 'coach', kind: 'text', text: 'Done. Push A moves to Thursday; you keep 4 days a week. See Plan.', at: at(9, 42) },
    ],
  },
}
const CHECKED = { ...COACHED, coachCheckIns: { [checkInWeek(COACHED)]: { feel: 'right', sleep: 'ok', note: 'Shoulder a bit tight', _ts: 1 } } }
const SUGGESTS = {
  id: 'r-demo', kind: 'review', summary: 'Friday was missed, so the loop moves forward.',
  changes: [
    { id: 'a', type: 'week', target: { weekday: 1 }, before: null, after: ['g-legs'], why: 'Friday was missed; the loop moves forward' },
    { id: 'b', type: 'week', target: { weekday: 3 }, before: null, after: ['g-pull'], why: 'Two rest days before Legs again' },
    { id: 'c', type: 'sets', target: { routineId: 'g-push', exId: '0025' }, before: 3, after: 4, why: 'Every set hit 8 last week' },
  ],
}
const status = (pending = null, job = null) => ({
  'GET /api/coach/status': { job, pending, cap: { used: 1, limit: 10 }, last: null, lastError: null, maxMessageLen: 2000 },
  'POST /api/coach/pending/resolve': { ok: true },
})
const coachMock = (S, pending, job) => ({ ...COACH, S, api: status(pending, job) })
const coach = () => <CoachChat />
const NOOP = () => {}
const toastOnly = text => async tt => { await tt.wait(200); useUI.getState().toast(text(), { action: t('Undo'), onAction: NOOP }); useUI.getState().pauseToast() }
// Coach off: the page replaces itself with Train once the config is known.
function CoachOff() {
  return useLocation().pathname === '/train' ? <TrainHub /> : <CoachChat />
}

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
  { id: 'T11.0', title: 'Coach, with suggestions', note: 'Three changes to toggle, Dismiss and Apply all, Check in, the chat and the composer.',
    path: '/train/coach', render: coach, mock: coachMock(COACHED, SUGGESTS) },
  { id: 'T11.0n', title: 'Coach, nothing pending', note: 'No suggestions: Check in, then the chat with the quick actions.',
    path: '/train/coach', render: coach, mock: coachMock(COACHED) },
  { id: 'T11.0j', title: 'Coach, thinking', note: 'A review running: the typing bubble and how long it takes; the composer waits.',
    path: '/train/coach', render: coach, mock: coachMock(COACHED, null, { id: 'j1', kind: 'review', state: 'running', startedAt: Date.now() }) },
  { id: 'T11.0m', title: 'Coach menu', note: 'The ⋯: everything the old header menu held.',
    path: '/train/coach', render: coach, mock: coachMock(COACHED), play: async tt => { await tt.wait(200); document.querySelector('.g-snav-end [aria-label="' + t('More') + '"]')?.click(); await tt.wait(200) } },
  { id: 'T11.1', title: 'Check in', note: 'This week, nothing picked yet: Send check-in waits for a feel.',
    path: '/train/coach', render: coach, mock: coachMock(COACHED), play: open(checkInSheet) },
  { id: 'T11.1p', title: 'Check in, filled in', note: 'This week’s check-in opens with its answers, to change.',
    path: '/train/coach', render: coach, mock: coachMock(CHECKED), play: open(checkInSheet) },
  { id: 'T11.2', title: 'Check-in noted', note: 'After Send: Checked in, and the toast with Undo (held).',
    path: '/train/coach', render: coach, mock: coachMock(CHECKED), play: toastOnly(() => t('Noted. See you next session.')) },
  { id: 'T11.3', title: 'Suggestions dismissed', note: 'After Dismiss: the suggestions are gone and the toast offers Undo for 8 s (held).',
    path: '/train/coach', render: coach, mock: coachMock(COACHED),
    play: toastOnly(() => tn('Dismissed {0} suggestion. Your Plan stays as it is', 'Dismissed {0} suggestions. Your Plan stays as it is', 3)) },
  { id: 'T11.0off', title: 'Coach off', note: '/train/coach lands on Train (replace): no Coach row, and the Gym card row instead.',
    path: '/train/coach', render: () => <CoachOff />, mock: { config: { coach: { enabled: false } }, user: ALEX, S: { ...COACHED, checkIn: true } } },
])
