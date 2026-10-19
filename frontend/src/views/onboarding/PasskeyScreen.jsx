import { useEffect, useRef, useState } from 'react'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import SuccessCheck from '../../ds/SuccessCheck.jsx'
import { vault } from '../../lib/api.js'
import { t } from '../../lib/i18n.js'
import { passkeySynced } from '../../lib/onboarding/api.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { answeredByData } from '../../lib/onboarding/flow.js'
import { useLater } from '../../lib/onboarding/use-later.js'
import { useThreadAnchor } from '../../lib/onboarding/use-thread-anchor.js'
import { reducedMotion } from '../../lib/reduced-motion.js'

// 1b Passkey saved (§3 screen 1b; board O2.2): where it went, from the passkey's backup flags
// (/api/me user.synced): synced to the person's password manager, kept on this device, or not
// known. Moves on by itself after 1.5s (2s under reduced motion), or at a tap. The step replaces
// itself in the history: there is no way back to making the account. The key's blade arrives as
// the thread and bends into the tick; the ring draws round it (under reduced motion it is there).
export default function PasskeyScreen() {
  const { state, go } = useOnboarding()
  const [synced, setSynced] = useState(null)
  const later = useLater()
  const tick = useRef(null)
  useThreadAnchor(tick, 'check')
  useEffect(() => {
    let live = true
    passkeySynced().then(v => { if (live) setSynced(v) })
    later(() => go('goal', { replace: true }), reducedMotion() ? 2000 : 1500)
    return () => { live = false }
  }, [go, later])
  const where = synced === true ? t('Saved to {0}. It works on all your devices.', vault())
    : synced === false ? t('Saved on this device.')
      : t('You’ll sign in with it from now on.')
  return <StepScreen center titleId="ob-pass-t" title={t('Passkey saved')} sub={where} stage={<SuccessCheck tickRef={tick} />}
    onTap={() => go('goal', { replace: true })}>
    {!answeredByData('goal', state.server) && <p className="ob-pass-next">{t('Your goal is next')}</p>}
  </StepScreen>
}
