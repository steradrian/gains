import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { dateLocale, t } from '../../../lib/i18n.js'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import { settingsPath } from '../paths.js'

const ACCOUNT = settingsPath('account')

// "18 Oct, 21:30" in the app's language.
const when = ms => {
  try { return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) } catch { return new Date(ms).toLocaleString() }
}

/* A2.10 Started over (board St2Fresh), where Start over lands (/me/account/started-over, routed by
   App.jsx, so it draws the stage page itself): when it happened (the reset's own stamp,
   S.resetAt, so a reload still says it) and Go to Today, which opens on its first day. A profile
   that never started over has nothing to show here and goes back to Account. */
export default function StartedOverScreen() {
  const nav = useNavigate()
  const resetAt = useStore(s => s.S?.resetAt)
  const signedIn = useStore(s => !!s.user)
  if (!resetAt) return <Navigate to={ACCOUNT} replace />
  return <StagePage parent={ACCOUNT}>
    <StagePageTitle title={t('Started over')} line={when(resetAt)} />
    <StageEmpty card={false} illustration="dumbbell" title={t('A clean slate')}
      body={signedIn ? t('Everything you logged is gone. Your account and passkeys are as they were.') : t('Everything you logged on this device is gone.')}
      action={t('Go to Today')} onClick={() => nav('/home')} />
  </StagePage>
}
