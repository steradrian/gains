// The Plan screen's "Coach suggests changes" banner (T3.2), fed from the same live source the
// Coach page reads: the status poll (lib/coach-api.js useCoachStatus). A proposal is pending on
// the server or the phone, never copied into the store, so two devices cannot disagree on it. The
// poll runs only while the Plan screen is open with Coach on and set up, at its idle pace.
//
// Wiring (views/plan/use-plan.js): `coach: useCoachBanner()`; PlanScreen draws the InlineBanner
// from `{ title, body, onReview, onDismiss }` and nothing for null.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, tn } from '../../../lib/i18n.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { applicable, coachAvailable, hasConsent, markStale } from '../../../lib/coach.js'
import { useCoachStatus } from '../../../lib/coach-api.js'
import { COACH_COMING_SOON } from '../../../lib/coach-availability.js'
import { useDismissPending } from '../../../lib/coach-dismiss.js'
import { useStore } from '../../../store/useStore.js'
import { dismissSuggestions } from './dismiss.js'

/**
 * The banner for `pending`, or null: only a review with a change that can still be applied.
 * Returns `{ title, body, count, proposal }`; `proposal` is the one marked against `S`, for Dismiss.
 */
export function coachBannerOf(S, pending) {
  if (!pending || pending.kind !== 'review') return null
  const proposal = markStale(pending, S)
  const count = applicable(proposal).length
  if (!count) return null
  const until = t('Nothing moves until you apply.')
  return {
    title: tn('Coach suggests {0} change', 'Coach suggests {0} changes', count),
    body: proposal.summary ? proposal.summary + ' ' + until : until,
    count,
    proposal,
  }
}

/** `{ title, body, onReview, onDismiss }` while a review waits, else null. */
export function useCoachBanner() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const on = !COACH_COMING_SOON && coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode }) && hasConsent(S) && !!S.coach?.profile
  const { pending, job, refresh } = useCoachStatus(on)
  const hidden = useDismissPending(pending?.id)
  return useMemo(() => {
    const banner = on && !job && !hidden ? coachBannerOf(S, pending) : null
    if (!banner) return null
    return {
      title: banner.title,
      body: banner.body,
      onReview: () => nav('/train/coach'),
      onDismiss: () => dismissSuggestions(banner.proposal, { onCommit: refresh }),
    }
  }, [on, job, hidden, S, pending, nav, refresh])
}
