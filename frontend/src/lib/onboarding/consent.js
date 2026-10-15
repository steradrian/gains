// The AI coach consent (ux-onboarding §3b 5b): what the coach sheet says before anything goes to
// the AI service, and the id of that text. Tapping Build my plan sends the id with the choice
// ({ consent: true, consentVersion }); the hub stamps the time with its own clock and checks the
// id against the texts it keeps (fitness-hub src/onboarding/consent.ts).
//
// The id names this exact text. Change a word of it and the id changes with it, here and in the
// hub's list first (consent.test.js holds the two together); an id is never reused.
import { t, tn } from '../i18n.js'

export const COACH_CONSENT_VERSION = 'ai-coach-build-v1'

/** The consent's two paragraphs: what the AI model reads, and where the answers go. */
export const coachConsentCopy = days => ({
  reads: tn('An AI model reads your goal, your body details and your {0} training day, then drafts a plan. You review it before anything goes on your week.',
    'An AI model reads your goal, your body details and your {0} training days, then drafts a plan. You review it before anything goes on your week.', days),
  where: t('These answers go to the AI service this Gains server uses. Your food log and your friends are not sent. Tapping Build my plan sends them once.'),
})
