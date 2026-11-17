import Onboarding from '../../../views/onboarding/Onboarding.jsx'
import { registerScreens } from '../registry.js'

// The onboarding's endings (O2.10–O2.16 of the entry boards): the starter plan and its drawer, the
// AI coach's consent, and the Summary for each way through, with its two drawers. Each is the real
// flow at its step's address; what the person answered is what this tab kept (`onboarding`), the
// hub answers the flow's state (and, for the coach, the plan it stored) and the daily targets.
const ALEX = { id: 'u1', name: 'Alex' }
// The AI coach's consent as the hub sends it (fitness-hub src/onboarding/consent.ts).
const CONSENT = {
  version: 'ai-coach-build-v1',
  reads: {
    one: 'An AI model reads your goal, your body details and your {0} training day, then drafts a plan. You review it before anything goes on your week.',
    other: 'An AI model reads your goal, your body details and your {0} training days, then drafts a plan. You review it before anything goes on your week.',
  },
  where: 'These answers go to the AI service this Gains server uses. Your food log and your friends are not sent. Tapping Build my plan sends them once.',
}
const COACH = { kind: 'coach', experience: null, equipment: 'gym', consentVersion: CONSENT.version, consentAt: '2026-10-19T08:00:00.000Z' }
const TARGETS = { calories: 2100, proteinG: 150, carbsG: 230, fatG: 70, waterMl: 2500 }
const hub = ({ stored = {} } = {}) => ({
  'GET /api/me': { user: { ...ALEX, synced: true } },
  'GET /api/onboarding': {
    answers: stored, completedAt: null, next: 'plan', remaining: ['plan'],
    coachAvailable: true, starterAvailable: true, coachConsent: CONSENT,
    prefill: { answered: [], sources: { opengym: 'ok', nutritrace: 'ok' } },
  },
  'POST /api/onboarding/preview': { ready: true, targets: TARGETS },
})

const UNITS = { weight: 'kg', height: 'cm', source: 'locale' }
const ALL = { sex: 'male', birthYear: 1994, heightCm: 178, weightKg: 81.5 }
const NOBODY = { sex: null, birthYear: null, heightCm: null, weightKg: null }
// Upper / lower on Monday, Tuesday, Thursday and Friday, for a full gym, as the boards draw it.
const STARTER = { kind: 'starter', templateId: 'upper-lower', weekdays: [1, 2, 4, 5], equipment: 'gym', experience: 'regular' }
// What this tab kept: the answers so far.
const tab = ({ body = ALL, ...answers } = {}) => ({
  uid: 'u1',
  answers: { goal: 'lose', activity: { value: 'sitting', source: 'default' }, plan: null, units: UNITS, body, trainingDays: 4, ...answers },
  starter: { templateId: 'upper-lower', weekdays: [1, 2, 4, 5], sel: 0, equipment: 'gym', experience: 'regular' },
})

const flow = () => <Onboarding />
const at = (step, onboarding, api = hub()) => ({ render: flow, path: '/onboarding/' + step, mock: { user: ALEX, api, onboarding } })
const SUMMARY = tab({ plan: STARTER })

registerScreens('Onboarding: the endings', [
  { id: 'O2.10', title: 'Your starter plan', note: 'Upper / lower for 4 days: the week, the first session’s exercises, Fitted to.', ...at('starter', tab()) },
  { id: 'O2.10f', title: 'Fitted to', note: 'The app’s own sheet over O2.10, with the board’s words.', ...at('starter', tab()),
    play: async t => { await t.click('Change') } },
  { id: 'O2.11', title: 'AI coach consent', note: 'The app’s own sheet over the plan step. Nothing is sent until Build my plan.', ...at('plan', tab()),
    play: async t => { await t.click('Have the AI coach build oneAn AI model drafts a plan from your answers. You review it first.'); await t.wait(700) } },
  // The hub's target is asked for once the answers have settled (300ms), then the ring fills.
  { id: 'O2.12', title: 'You’re all set', note: 'A starter plan: the week and the next session.', ...at('finish', SUMMARY),
    play: async t => { await t.wait(600) } },
  { id: 'O2.12a', title: 'Adjust your target', note: 'Pace and mode, read-only: the hub has no way to store either yet.', ...at('finish', SUMMARY),
    play: async t => { await t.click('Adjust') } },
  { id: 'O2.12d', title: 'Your day is mostly', note: 'A pick goes back to the Summary.', ...at('finish', SUMMARY),
    play: async t => { await t.click('Assumes a mostly-seated day ·Change') } },
  { id: 'O2.13', title: 'All set, coach building', note: 'The plan is the one the hub stored with the consent.',
    ...at('finish', tab(), hub({ stored: { plan: COACH } })) },
  { id: 'O2.14', title: 'All set, no plan', ...at('finish', tab({ plan: { kind: 'none' } })) },
  { id: 'O2.15', title: 'All set, just food', note: '0 training days.', ...at('finish', tab({ trainingDays: 0 })) },
  { id: 'O2.16', title: 'All set, no details', note: 'About you skipped: the dashed ring and Set your target.',
    ...at('finish', tab({ body: NOBODY, plan: STARTER })) },
])
