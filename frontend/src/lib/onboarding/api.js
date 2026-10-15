// The onboarding's server side, as the browser reaches it.
//
//   GET  /api/invites/{code}            openGym's invite check, which never uses the invite up
//   GET  /api/me                        whether the new passkey is synced (user.synced)
//   GET  /hub/api/onboarding            where the person is: { answers, completedAt, coachAvailable }
//   PUT  /hub/api/onboarding            one step's answers: { step, answers }
//   POST /hub/api/onboarding/preview    the daily targets from the answers so far
//   POST /hub/api/onboarding/complete   both apps written, once: { today }
//
// The hub routes are written to the contract of fitness-eval ux-onboarding.md §3b: the body's four
// answers each optional, activity and units with their source, trainingDays 0-6 or null, the plan a
// union of starter | coach | none, and coachAvailable on GET. Where the hub answers otherwise the
// call fails and the screens say so; nothing here makes an answer up.
import { api } from '../api.js'
import { appBase } from '../app-base.js'

const HUB = '/hub/api/onboarding'
const TIMEOUT_MS = 20000

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
  if (!res.ok) throw failure(data?.error || `HTTP ${res.status}`, res.status, data?.code === 'complete' ? 'complete' : 'http')
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

/** One step's answers as the hub takes them (§3b). Body answers not given are left out. */
export function stepAnswers(step, answers) {
  switch (step) {
    case 'goal': return { goal: answers.goal }
    case 'body': {
      const out = {}
      for (const k of ['sex', 'birthYear', 'heightCm', 'weightKg']) if (answers.body[k] != null) out[k] = answers.body[k]
      return { ...out, activity: answers.activity, units: answers.units }
    }
    case 'training': return { trainingDays: answers.trainingDays ?? null }
    case 'plan': return answers.plan
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
    for (const k of ['sex', 'birthYear', 'heightCm', 'weightKg']) out.body[k] = body[k] ?? null
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
  body: stepAnswers('body', answers),
  ...(answers.trainingDays !== undefined ? { training: stepAnswers('training', answers) } : {}),
})

/** Completes the onboarding on the person's own date. */
export const completeOnboarding = today => hub('POST', HUB + '/complete', { today })
