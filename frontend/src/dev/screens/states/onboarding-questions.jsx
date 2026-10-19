import Onboarding from '../../../views/onboarding/Onboarding.jsx'
import { registerScreens } from '../registry.js'

// The onboarding's questions (O2.3–O2.9 of the entry boards), each the real flow at its step's
// address. What the person has answered so far is what this tab kept (`onboarding`); the hub
// answers the flow's state and the live target's preview.
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
const hub = ({ coach = true } = {}) => ({
  'GET /api/me': { user: { ...ALEX, synced: true } },
  'GET /api/onboarding': {
    answers: {}, completedAt: null, next: 'goal', remaining: ['goal', 'body', 'training', 'plan'],
    coachAvailable: coach, starterAvailable: true, ...(coach ? { coachConsent: CONSENT } : {}),
    prefill: { answered: [], sources: { opengym: 'ok', nutritrace: 'ok' } },
  },
  'POST /api/onboarding/preview': { ready: true, targets: { calories: 2100 } },
})

const METRIC = { weight: 'kg', height: 'cm', source: 'locale' }
const IMPERIAL = { weight: 'lb', height: 'ft', source: 'locale' }
const NOBODY = { sex: null, birthYear: null, heightCm: null, weightKg: null }
// What this tab kept: the answers so far, in the region's units.
const tab = ({ units = METRIC, body = {}, ...answers } = {}) => ({
  uid: 'u1',
  answers: { goal: null, activity: { value: 'sitting', source: 'default' }, plan: null, units, body: { ...NOBODY, ...body }, ...answers },
})
const SEX = { sex: 'female' }
const BORN = { ...SEX, birthYear: 1994 }
const TALL = { ...BORN, heightCm: 178 }
const ALL = { ...TALL, weightKg: 81.5 }

const flow = () => <Onboarding />
const at = (step, onboarding, api = hub()) => ({ render: flow, path: '/onboarding/' + step, mock: { user: ALEX, api, onboarding } })

registerScreens('Onboarding: the questions', [
  { id: 'O2.3', title: 'Your goal', note: 'Nothing picked; a tap moves on after 650ms.', ...at('goal', tab()) },
  { id: 'O2.3p', title: 'Your goal, picked', note: 'Lose weight, as it shows the moment it is tapped (or arrowed to).', ...at('goal', tab({ goal: 'lose' })) },
  { id: 'O2.4', title: 'Your sex', note: 'The live target stands over the floor Goal’s line holds on.', ...at('sex', tab({ goal: 'lose' })) },
  { id: 'O2.4w', title: 'Why we ask', note: 'The app’s own sheet over O2.4, with the board’s words.', ...at('sex', tab({ goal: 'lose' })),
    play: async t => { await t.click('Why we ask') } },
  { id: 'O2.5', title: 'When you were born', note: 'The year has no unit: metric and imperial look the same.', ...at('born', tab({ goal: 'lose', body: BORN })) },
  { id: 'O2.5i', title: 'When you were born, imperial region', ...at('born', tab({ goal: 'lose', body: BORN, units: IMPERIAL })) },
  { id: 'O2.6', title: 'How tall you are', ...at('height', tab({ goal: 'lose', body: TALL })) },
  { id: 'O2.6i', title: 'How tall you are, imperial region', note: 'The ruler starts in feet and inches; the chip switches it.',
    ...at('height', tab({ goal: 'lose', body: TALL, units: IMPERIAL })) },
  { id: 'O2.7', title: 'What you weigh', note: 'All four in: the hub’s target, exact.', ...at('weight', tab({ goal: 'lose', body: ALL })) },
  { id: 'O2.7i', title: 'What you weigh, imperial region', note: 'The ruler starts in pounds.',
    ...at('weight', tab({ goal: 'lose', body: ALL, units: IMPERIAL })) },
  { id: 'O2.8', title: 'How often you train, 4 days', note: 'The suggested days light up.', ...at('training', tab({ goal: 'lose', body: ALL, trainingDays: 4 })) },
  { id: 'O2.8z', title: 'How often you train, 0 days', note: 'Only food: the flow skips the plan.', ...at('training', tab({ goal: 'lose', body: ALL, trainingDays: 0 })) },
  { id: 'O2.9', title: 'Your plan', note: 'Three choices; this server has an AI coach.', ...at('plan', tab({ goal: 'lose', body: ALL, trainingDays: 4 })) },
  { id: 'O2.9n', title: 'Your plan, no AI coach', note: 'No coach on this server: two choices.',
    ...at('plan', tab({ goal: 'lose', body: ALL, trainingDays: 4 }), hub({ coach: false })) },
])
