import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import { useThreadAnchor } from '../../lib/onboarding/use-thread-anchor.js'
import { todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { completeOnboarding } from '../../lib/onboarding/api.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { detourOf } from '../../lib/onboarding/flow.js'
import { forget } from '../../lib/onboarding/state.js'
import { useUI } from '../../store/useUI.js'

// PLACEHOLDER for the Summary (ux-onboarding §3b screen 6, motion-onboarding-summary-v2.md). The
// Summary and its hand-over to Home are built later, on top of the redesigned Home; until then
// this step only finishes: every answer saved, the onboarding completed on the hub (both apps
// written through its outbox), then Home. Missing body answers can still be added first, by the
// skip map's detour ("Add my details" → only the missing steps → back here). It keeps a plain
// floor so the thread has a line to land on, as every onboarding screen does.

// The hub's steps in their order: a step's answer can depend on the one before (a plan on the
// training days), so failed saves go again one at a time, in this order.
const HUB_STEPS = ['goal', 'body', 'training', 'plan']

export default function FinishScreen() {
  const navigate = useNavigate()
  const { state, act, saveHubStep, go, refresh } = useOnboarding()
  const [status, setStatus] = useState('idle') // idle | saving | error
  const floor = useRef(null)
  useThreadAnchor(floor, 'line')
  const missing = detourOf(state.answers)

  const finish = async () => {
    setStatus('saving')
    // Nothing completes with an answer the hub has not taken: those are sent again first.
    for (const step of HUB_STEPS.filter(s => state.unsaved.includes(s))) {
      if (!(await saveHubStep(step))) { setStatus('error'); return }
    }
    let done = null
    try {
      done = await completeOnboarding(todayISO())
    } catch (e) {
      if (e.code === 'plan-unavailable') {
        // The plan chosen is one this server cannot take (any more): the hub cleared it, so the
        // Plan step is asked again with what it can take.
        act({ type: 'plan', plan: null })
        await refresh()
        useUI.getState().toast(t('That plan can’t be set up on this server right now. Pick another.'))
        setStatus('idle')
        go('plan')
        return
      }
      if (e.code !== 'complete') { setStatus('error'); return }
    }
    // Completed, and Training has not taken its part yet (openGym busy, or behind the hub): the
    // hub keeps sending it. Said once, so nobody looks for a plan or a weigh-in that is on its way.
    const training = done?.delivery?.opengym
    if (training && training !== 'done') useUI.getState().toast(t('Saved. Some of it is still on its way to Training and will show up there soon.'))
    forget()
    act({ type: 'reset' })
    navigate('/home', { replace: true })
  }
  const details = () => {
    act({ type: 'detour', steps: missing })
    go(missing[0])
  }
  return (
    <StepScreen titleId="ob-finish-t"
      title={status === 'error' ? t('Your answers could not be saved yet') : t('That’s everything for now')}
      sub={status === 'error' ? t('Check your connection and try again. Nothing you answered is lost.') : t('Your answers set up your Home.')}
      stage={<svg className="ob-fin-art" viewBox="0 0 320 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path ref={floor} d="M16 8 H304" />
      </svg>}
      footer={<>
        <Button variant="primary" disabled={status === 'saving'} aria-busy={status === 'saving' || undefined} onClick={finish}>
          {status === 'error' ? t('Try again') : t('Go to Home')}
        </Button>
        {status === 'error' && <Button variant="plain" onClick={() => navigate('/home', { replace: true })}>{t('Finish later')}</Button>}
        {status !== 'error' && missing.length > 0 && <Button variant="tinted" onClick={details}>{t('Add my details')}</Button>}
      </>} />
  )
}
