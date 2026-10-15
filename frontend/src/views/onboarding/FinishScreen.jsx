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

// PLACEHOLDER for the Summary (ux-onboarding §3b screen 6, motion-onboarding-summary-v2.md). The
// Summary and its hand-over to Home are built later, on top of the redesigned Home; until then
// this step only finishes: every answer saved, the onboarding completed on the hub (both apps
// written through its outbox), then Home. Missing body answers can still be added first, by the
// skip map's detour ("Add my details" → only the missing steps → back here). It keeps a plain
// floor so the thread has a line to land on, as every onboarding screen does.
export default function FinishScreen() {
  const navigate = useNavigate()
  const { state, act, saveHubStep, go } = useOnboarding()
  const [status, setStatus] = useState('idle') // idle | saving | error
  const floor = useRef(null)
  useThreadAnchor(floor, 'line')
  const missing = detourOf(state.answers)

  const finish = async () => {
    setStatus('saving')
    // Nothing completes with an answer the hub has not taken: those are sent again first.
    const results = await Promise.all(state.unsaved.map(step => saveHubStep(step)))
    if (results.some(ok => !ok)) { setStatus('error'); return }
    try {
      await completeOnboarding(todayISO())
    } catch (e) {
      if (e.code !== 'complete') { setStatus('error'); return }
    }
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
