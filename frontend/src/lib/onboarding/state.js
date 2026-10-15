// What the onboarding knows so far, and every change a screen can make to it. Pure: the provider
// (components/onboarding/OnboardingLayout.jsx) keeps it in a reducer, mirrors it into session
// storage so a reload resumes, and saves each answered step to the hub.
//
// answers.trainingDays: undefined until asked, null when skipped, 0-6 once answered.
// answers.plan: null, or { kind: 'starter', templateId, weekdays, equipment, experience }
//   | { kind: 'coach', experience, equipment, consentAt } | { kind: 'none' }.
import { localeUnits } from './units.js'
import { suggestedDays, templateFor } from './plans.js'

const STORE_KEY = 'gains_onboarding'

export function initialState(units = localeUnits()) {
  return {
    code: null,
    invite: null,
    // The name typed on the name step, until the passkey makes it the profile's.
    name: null,
    answers: {
      goal: null,
      body: { sex: null, birthYear: null, heightCm: null, weightKg: null },
      // A mostly seated day until the person says otherwise (§3b: changed on the Summary).
      activity: { value: 'sitting', source: 'default' },
      units,
      trainingDays: undefined,
      plan: null,
    },
    // The Plan step's card on screen ('starter' | 'coach' | 'none'), before it is a plan.
    pick: null,
    // The starter preview's own choices: the weekdays per session, the one selected, the fit.
    starter: null,
    detour: null,
    skippedYou: false,
    // Hub steps whose last save failed: sent again before completing.
    unsaved: [],
    progress: [0, 0, 0],
    coachAvailable: null,
  }
}

const withAnswers = (s, patch) => ({ ...s, answers: { ...s.answers, ...patch } })
const unsavedWith = (s, step) => (s.unsaved.includes(step) ? s.unsaved : [...s.unsaved, step])

/** A fresh starter preview for `days`: the plan's own weekdays, the first session selected. */
export const starterFor = (days, prev) => ({
  templateId: templateFor(days),
  weekdays: suggestedDays(days),
  sel: 0,
  experience: prev?.experience || 'new',
  equipment: prev?.equipment || 'gym',
})

export function reduce(s, a) {
  switch (a.type) {
    case 'invite': return { ...s, code: a.code, invite: a.invite ?? s.invite }
    case 'name': return { ...s, name: a.name }
    case 'goal': return withAnswers(s, { goal: a.goal })
    case 'body': return withAnswers(s, { body: { ...s.answers.body, [a.field]: a.value } })
    case 'unit': return withAnswers(s, { units: { ...s.answers.units, [a.kind]: a.unit, source: 'user' } })
    case 'training': {
      const changed = s.answers.trainingDays !== a.days
      const next = withAnswers(s, { trainingDays: a.days, ...(changed ? { plan: null } : {}) })
      return changed ? { ...next, pick: null, starter: null } : next
    }
    case 'skipYou': return { ...s, skippedYou: true, detour: null }
    case 'skipTraining': return { ...withAnswers(s, { trainingDays: null, plan: null }), pick: null, starter: null }
    case 'pick': return { ...s, pick: a.pick }
    case 'starter': return { ...s, starter: { ...(s.starter || starterFor(s.answers.trainingDays)), ...a.patch } }
    case 'plan': return { ...withAnswers(s, { plan: a.plan }), pick: a.plan ? a.plan.kind : null }
    case 'detour': return { ...s, detour: a.steps && a.steps.length ? a.steps : null }
    case 'saved': return { ...s, unsaved: a.ok ? s.unsaved.filter(x => x !== a.step) : unsavedWith(s, a.step) }
    case 'progress': return { ...s, progress: a.progress }
    case 'hub': {
      // What the server holds fills what this tab does not know yet; an answer given here and
      // not saved yet stays.
      const stored = a.answers || {}
      const known = (local, server) => (local === null || local === undefined ? server ?? local : local)
      const body = { ...s.answers.body }
      for (const k of Object.keys(body)) body[k] = known(body[k], stored.body?.[k])
      const answers = {
        ...s.answers,
        goal: known(s.answers.goal, stored.goal),
        body,
        activity: s.answers.activity.source === 'default' && stored.activity ? stored.activity : s.answers.activity,
        units: s.answers.units.source === 'locale' && stored.units ? stored.units : s.answers.units,
        trainingDays: s.answers.trainingDays === undefined ? stored.trainingDays : s.answers.trainingDays,
        plan: known(s.answers.plan, stored.plan),
      }
      return { ...s, answers, coachAvailable: typeof a.coachAvailable === 'boolean' ? a.coachAvailable : s.coachAvailable }
    }
    case 'reset': return initialState(s.answers.units)
    default: throw new Error('unknown onboarding action ' + a.type)
  }
}

/** The state kept for this browser tab, or null. */
export function loadSaved(storage = globalThis.sessionStorage) {
  try {
    const v = JSON.parse(storage?.getItem(STORE_KEY) || 'null')
    if (!v || typeof v !== 'object' || !v.answers || !v.answers.body) return null
    // JSON has no undefined: a training step not asked yet comes back absent.
    return { ...initialState(), ...v, answers: { ...initialState().answers, ...v.answers } }
  } catch { return null }
}

export function save(state, storage = globalThis.sessionStorage) {
  try { storage?.setItem(STORE_KEY, JSON.stringify(state)) } catch { /* private mode: this tab only */ }
}

export function forget(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(STORE_KEY) } catch { /* nothing kept */ }
}
