import { useEffect, useState } from 'react'
import { dateLocale, t } from '../i18n.js'
import { previewTargets } from './api.js'
import { bodyComplete } from './flow.js'
import { estimateRange } from './estimate.js'

// The answers the hub's preview was last asked for, and its answer: every About-you screen shows
// the same ring, so moving between them asks once.
let asked = null
let answer = null

const keyOf = a => JSON.stringify([a.goal, a.body, a.activity?.value, a.trainingDays ?? null])

/**
 * What the live ring on About you shows (§3b): { lo, hi, answered, exact }. `exact` is the hub's
 * calorie target once all four body answers are in (POST /hub/api/onboarding/preview), null until
 * it answers or when it cannot; until then lo–hi is the estimate's range (lib/onboarding/estimate.js).
 */
export function useTarget(answers) {
  const range = estimateRange(answers)
  const complete = bodyComplete(answers)
  const key = complete ? keyOf(answers) : null
  const [exact, setExact] = useState(() => (key && key === asked ? answer : null))
  useEffect(() => {
    if (!key) { setExact(null); return undefined }
    if (key === asked) { setExact(answer); return undefined }
    let live = true
    // Settled answers only: a ruler being dragged asks once it stops.
    const timer = setTimeout(() => {
      asked = key
      answer = null
      previewTargets(answers).then(res => {
        answer = res?.ready && Number.isFinite(res.targets?.calories) ? res.targets.calories : null
        if (live) setExact(answer)
      }).catch(() => {
        // No answer is not an answer: the same answers ask again next time.
        asked = null
        if (live) setExact(null)
      })
    }, 300)
    return () => { live = false; clearTimeout(timer) }
    // keyed on the answers' content, not the object
  }, [key])
  return { ...range, exact }
}

export const kcalText = n => Math.round(n).toLocaleString(dateLocale())

/** The caption a settled answer leaves: the target as it stands now. */
export function targetSentence(target) {
  if (target.exact != null) return t('Your starting target: {0} kcal a day.', kcalText(target.exact))
  if (target.lo === target.hi) return t('Your target is now about {0} kcal a day.', kcalText(target.lo))
  return t('Your target is now about {0} to {1} kcal a day.', kcalText(target.lo), kcalText(target.hi))
}
