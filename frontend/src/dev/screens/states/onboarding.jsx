import Onboarding from '../../../views/onboarding/Onboarding.jsx'
import { creationOptions, denied, pending } from '../mock-env.js'
import { registerScreens } from '../registry.js'

// The onboarding's entry (O1.0–O1.5, O2.1–O2.2 of the entry boards). Every state is the real
// flow, Onboarding, at the address the state starts on; `mock` is what the invite check, the hub
// and the passkey prompt answer, and what this tab kept from the landing, and `play` is the
// tapping that brings it there.
const CODE = 'AB12'
const INVITE = `/join/${CODE}`
const check = answer => ({ [`GET /api/invite/${CODE}`]: answer })
const VALID = { status: 'valid', inviterName: 'Andrei', suggestedName: 'Alex' }
// What the landing keeps for this tab before there is an account: the code and its answer.
const LANDED = { uid: null, code: CODE, invite: VALID, name: null }
const REGISTER = { 'POST /api/register/options': { cid: 'c', options: creationOptions } }
const ALEX = { id: 'u1', name: 'Alex' }
// The hub of someone who has just made their account: nothing answered yet.
const HUB = {
  'GET /api/onboarding': {
    answers: {}, completedAt: null, next: 'goal', remaining: ['goal', 'body', 'training', 'plan'],
    coachAvailable: false, starterAvailable: true, prefill: { answered: [], sources: { opengym: 'ok', nutritrace: 'ok' } },
  },
}

const flow = () => <Onboarding />
const cancelled = async t => { await t.click('Create passkey') }

registerScreens('Onboarding: the entry', [
  { id: 'O1.0', title: 'The invite', note: 'Andrei is the inviter the check names; the group row has no count (the check does not say).',
    render: flow, path: INVITE, mock: { api: check(VALID) } },
  { id: 'O1.1', title: 'Opening the invite', note: 'The check is still out.', render: flow, path: INVITE, mock: { api: check(pending) } },
  { id: 'O1.2', title: 'Invite expired', note: 'Revoked and unknown codes are drawn the same, with their own titles.',
    render: flow, path: INVITE, mock: { api: check({ status: 'expired', inviterName: null, suggestedName: null }) } },
  { id: 'O1.3', title: 'Invite already used', render: flow, path: INVITE,
    mock: { api: check({ status: 'used', inviterName: null, suggestedName: null }) } },
  { id: 'O1.4', title: 'Opened offline', note: 'Online, a check with no answer says “We couldn’t check this invite” instead.',
    render: flow, path: INVITE, mock: { online: false, api: check({ status: 503, body: { error: 'unavailable' } }) } },
  { id: 'O1.5', title: 'Already signed in', note: 'The invite is not checked, so it stays unused.', render: flow, path: INVITE,
    mock: { user: ALEX, api: HUB } },
  { id: 'O2.1', title: 'Your name', note: 'Step 1 of 8; the name the inviter suggested.', render: flow, path: '/onboarding/name',
    mock: { onboarding: LANDED } },
  { id: 'O2.1e', title: 'No passkey created', note: 'The prompt was closed: the alert shakes once and holds focus.',
    render: flow, path: '/onboarding/name', mock: { onboarding: LANDED, api: REGISTER, credentials: { create: denied } }, play: cancelled },
  { id: 'O2.1t', title: 'Having trouble?', note: 'A drawer over O2.1e.', render: flow, path: '/onboarding/name',
    mock: { onboarding: LANDED, api: REGISTER, credentials: { create: denied } },
    play: async t => { await cancelled(t); await t.click('Having trouble?') } },
  { id: 'O2.2', title: 'Passkey saved', note: 'Moves on to the goal by itself after 1.5 s, as the app does, or at a tap.',
    render: flow, path: '/onboarding/passkey',
    mock: { user: ALEX, api: { ...HUB, 'GET /api/me': { user: { ...ALEX, synced: true } } } } },
])
