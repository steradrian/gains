// The AI coach consent text and its id travel together: the hub stores the id as what the person
// agreed to, so the text it names can never change under it.
import { describe, expect, it } from 'vitest'
import { COACH_CONSENT_VERSION, coachConsentCopy } from './consent.js'

// The text each id stood for, in English, as the hub keeps it (fitness-hub src/onboarding/consent.ts).
const TEXTS = {
  'ai-coach-build-v1': [
    'An AI model reads your goal, your body details and your 2 training days, then drafts a plan. You review it before anything goes on your week.',
    'These answers go to the AI service this Gains server uses. Your food log and your friends are not sent. Tapping Build my plan sends them once.',
  ],
}

describe('the AI coach consent', () => {
  it('is the text its id names: a changed word needs a new id, here and in the hub', () => {
    const copy = coachConsentCopy(2)
    expect(TEXTS[COACH_CONSENT_VERSION], `no text on record for ${COACH_CONSENT_VERSION}`).toBeDefined()
    expect([copy.reads, copy.where]).toEqual(TEXTS[COACH_CONSENT_VERSION])
  })

  it('has an id of the form the hub and openGym take', () => {
    expect(COACH_CONSENT_VERSION).toMatch(/^[a-z0-9-]{1,40}$/)
  })
})
