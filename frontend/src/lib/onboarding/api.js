// The onboarding's server side, as the browser reaches it.
//
//   GET  /api/invites/{code}            openGym's invite check, which never uses the invite up
//   GET  /api/me                        whether the new passkey is synced (user.synced)
//   GET  /hub/api/onboarding            where the person is: { answers, completedAt, next, remaining,
//                                       prefill, coachAvailable, starterAvailable, coachConsent,
//                                       delivery, plan }. `plan` { status: 'refused' }: openGym
//                                       refused the plan after completing (lib/onboarding/use-plan-refused.js).
//   PUT  /hub/api/onboarding            one step's answers: { step, answers } (answers null: skipped)
//   POST /hub/api/onboarding/preview    the daily targets from the answers so far
//   POST /hub/api/onboarding/complete   both apps written, once: { today }. 409 `plan-unavailable`:
//                                       the plan chosen is one this server cannot take; ask again.
//
// The hub routes are written to the contract of fitness-eval ux-onboarding.md §3b: the body's four
// answers each optional, activity and units with their source, trainingDays 0-6 or null, the plan a
// union of starter | coach | none (the coach as a consent to a text by its id, the time the hub's),
// and on GET what the person's data answers and which plans this server takes. Where the hub
// answers otherwise the call fails and the screens say so; nothing here makes an answer up.
import { api } from '../api.js'
import { appBase } from '../app-base.js'

const HUB = '/hub/api/onboarding'
const TIMEOUT_MS = 20000
// The refusals a screen acts on; any other is 'http'.
const KNOWN_CODES = ['complete', 'plan-unavailable']
const BODY_FIELDS = ['sex', 'birthYear', 'heightCm', 'weightKg']

const failure = (message, status, code) => Object.assign(new Error(message), { status, code })

// Same origin, the openGym session cookie: the hub checks both itself.
async function hub(method, path, body) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(appBase().replace(/\/$/, '') + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    })
  } catch {
    throw failure('no answer', 0, ctl.signal.aborted ? 'timeout' : 'offline')
  } finally {
    clearTimeout(timer)
  }
  let data = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) throw failure(data?.error || `HTTP ${res.status}`, res.status, KNOWN_CODES.includes(data?.code) ? data.code : 'http')
  if (!data || typeof data !== 'object') throw failure('not JSON', res.status, 'bad-response')
  return data
}

/**
 * The invite landing's check: { status: 'valid'|'used'|'revoked'|'expired'|'invalid', inviterName,
 * suggestedName }. A code the server does not know is 'invalid'; no answer at all throws
 * ({ code: 'unavailable' }) so the landing can offer to try again.
 */
export async function checkInvite(code) {
  try {
    const found = await api('/api/invites/' + encodeURIComponent(code))
    return { status: found.status, inviterName: found.inviterName ?? null, suggestedName: found.suggestedName ?? null }
  } catch (e) {
    if (e.status === 404) return { status: 'invalid', inviterName: null, suggestedName: null }
    throw failure(e.message, e.status || 0, 'unavailable')
  }
}

/** Whether the profile's passkeys sync (true), stay on this device (false), or it is not known (null). */
export async function passkeySynced() {
  try {
    const me = await api('/api/me')
    return typeof me.user?.synced === 'boolean' ? me.user.synced : null
  } catch { return null }
}

// The body as the screens hold it: the four answers given, the day and the units with their source.
function bodyOf(answers) {
  const out = {}
  for (const k of BODY_FIELDS) if (answers.body[k] != null) out[k] = answers.body[k]
  return { ...out, activity: answers.activity, units: answers.units }
}

// The plan as the hub takes it: the AI coach as a consent to the text shown, by the id the hub
// sent with it, and never a time (the hub stamps it, and a stored choice it sends back carries its
// stamp).
function planOf(plan) {
  if (plan?.kind !== 'coach') return plan
  return { kind: 'coach', experience: plan.experience ?? null, equipment: plan.equipment, consent: true, consentVersion: plan.consentVersion }
}

/**
 * One step's answers as the hub takes them (§3b). Body answers not given are left out, and a body
 * with nothing the person said (no answer, the assumed day and units) is a skip: null.
 */
export function stepAnswers(step, answers) {
  switch (step) {
    case 'goal': return { goal: answers.goal }
    case 'body': {
      const said = BODY_FIELDS.some(k => answers.body[k] != null) || answers.activity.source === 'user' || answers.units.source === 'user'
      return said ? bodyOf(answers) : null
    }
    case 'training': return { trainingDays: answers.trainingDays ?? null }
    case 'plan': return planOf(answers.plan)
    default: throw new Error('unknown onboarding step ' + step)
  }
}

/** The hub's stored answers (step → the body PUT sent) back into the screens' answers. */
export function answersFromHub(stored) {
  const out = {}
  if (!stored || typeof stored !== 'object') return out
  const { goal, body, training, plan } = stored
  if (goal && typeof goal.goal === 'string') out.goal = goal.goal
  if (body && typeof body === 'object') {
    out.body = {}
    for (const k of BODY_FIELDS) out.body[k] = body[k] ?? null
    if (body.activity) out.activity = body.activity
    if (body.units) out.units = body.units
  }
  if (training && 'trainingDays' in training) out.trainingDays = training.trainingDays
  if (plan && typeof plan.kind === 'string') out.plan = plan
  return out
}

export const loadOnboarding = () => hub('GET', HUB)
export const saveStep = (step, answers) => hub('PUT', HUB, { step, answers: stepAnswers(step, answers) })

/** { ready: true, targets: { calories, … } } | { ready: false, missing } from the answers on screen. */
export const previewTargets = answers => hub('POST', HUB + '/preview', {
  ...(answers.goal ? { goal: stepAnswers('goal', answers) } : {}),
  body: bodyOf(answers),
  ...(answers.trainingDays !== undefined ? { training: stepAnswers('training', answers) } : {}),
})

/** Completes the onboarding on the person's own date. */
export const completeOnboarding = today => hub('POST', HUB + '/complete', { today })
