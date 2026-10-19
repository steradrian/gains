import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '../../brand.js'
import StageArt from '../../components/onboarding/StageArt.jsx'
import StageNotice from '../../components/onboarding/StageNotice.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import Button from '../../ds/Button.jsx'
import GlassList from '../../ds/GlassList.jsx'
import { passkeyError, passkeyLogin } from '../../lib/api.js'
import { t } from '../../lib/i18n.js'
import { checkInvite } from '../../lib/onboarding/api.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { codeOf } from '../../lib/onboarding/flow.js'
import { askAddDeviceData } from '../../sheets.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// 0 Invite landing, /join/<code> (ux-onboarding §3, §6; boards O1.0-O1.5): the invite is checked
// on arrival, without using it up, so a bad one shows here with a next step instead of after the
// name and the passkey.
//   checking            O1.1 placeholders, "Opening your invite"
//   valid               O1.0 "{inviter} invited you to Gains" → Create my account · I already have an account
//   expired / revoked / invalid   O1.2 the scene set back → I already have an account
//   used                O1.3 "already used" → Sign in
//   no answer           O1.4 "You're offline" when the browser is, else "couldn't check" → Try again
//   signed in already   O1.5 "You're already in" → Go to Today (the invite stays unused)
// The check answers only the inviter's name, and only for a valid invite (api/invites.js): the
// boards' inviter on the expired and used screens, and the group's size, are not known here.
const invitedTitle = inviter => (inviter ? t('{0} invited you to {1}', inviter, BRAND.name) : t('You’re invited to {0}', BRAND.name))

export default function InviteScreen() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const code = codeOf(pathname)
  const { state, act, go } = useOnboarding()
  const user = useStore(s => s.user)
  const [check, setCheck] = useState(() => (state.code === code && state.invite ? { kind: 'ok', invite: state.invite } : { kind: code ? 'loading' : 'ok', invite: code ? null : { status: 'invalid' } }))
  const [tries, setTries] = useState(0)

  // A landing with no code is no invite session: one kept from an earlier visit is let go.
  useEffect(() => {
    if (!code && !user) act({ type: 'invite', code: null, invite: null })
  }, [code, user, act])

  useEffect(() => {
    if (!code || user) return undefined
    let live = true
    checkInvite(code).then(invite => {
      if (!live) return
      act({ type: 'invite', code, invite })
      setCheck({ kind: 'ok', invite })
    }).catch(() => { if (live) setCheck({ kind: 'unavailable' }) })
    return () => { live = false }
  }, [code, user, tries, act])

  const signIn = async () => {
    try {
      const u = await passkeyLogin()
      useStore.getState().setUser(u, { adopt: true })
      await useStore.getState().adoptProfile(askAddDeviceData)
      navigate('/home', { replace: true })
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(passkeyError(e, t('Sign-in failed')))
    }
  }

  if (user) {
    return <StepScreen noNav far titleId="ob-inv-t" title={t('You’re already in')}
      sub={t('This phone is signed in as {0}. The invite stays unused, so it still works for someone else.', user.name)}
      footer={<Button onClick={() => navigate('/home', { replace: true })}>{t('Go to Today')}</Button>}>
      <StageNotice icon="users" title={t('Signed in as {0}', user.name)}>{t('To make a second profile, sign out first in Settings › Account.')}</StageNotice>
    </StepScreen>
  }
  // No scene while the check is out: the answer brings the inviter's initial and a subtitle, which
  // move the scene down, and the thread is born on the floor where it will stay.
  if (check.kind === 'loading') return <StepScreen skeleton titleId="ob-inv-t" title={t('Opening your invite')} />
  if (check.kind === 'unavailable') {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    const retry = <Button onClick={() => { setCheck({ kind: 'loading' }); setTries(n => n + 1) }}>{t('Try again')}</Button>
    if (!offline) {
      return <StepScreen noNav far titleId="ob-inv-t" title={t('We couldn’t check this invite')} sub={t('Check your connection and try again.')} footer={retry} />
    }
    return <StepScreen noNav far titleId="ob-inv-t" title={t('You’re offline')} sub={t('Your invite needs a connection to open.')} footer={retry}>
      <StageNotice icon="wifiOff" title={t('No connection')}>{t('Connect to Wi-Fi or mobile data, then try again.')}</StageNotice>
    </StepScreen>
  }
  const { status, inviterName } = check.invite
  const stage = <StageArt name="invite" birth width={status === 'valid' ? 320 : 300} />
  if (status === 'used') {
    return <StepScreen noNav titleId="ob-inv-t" title={t('This invite was already used')} stage={stage} stageDim
      sub={t('Each link works once. If it was you, sign in. If not, ask whoever invited you for a new link.')}
      footer={<Button onClick={signIn}>{t('Sign in')}</Button>} />
  }
  if (status !== 'valid') {
    const title = status === 'expired' ? t('This invite has expired')
      : status === 'invalid' ? t('This invite link doesn’t work')
        : t('This invite is no longer valid')
    return <StepScreen noNav titleId="ob-inv-t" title={title} stage={stage} stageDim
      sub={t('Ask whoever invited you for a new link; it opens right here.')}
      footer={<Button variant="glass" onClick={signIn}>{t('I already have an account')}</Button>} />
  }
  const inviter = inviterName?.trim()
  return (
    <StepScreen noNav hero titleId="ob-inv-t" stage={stage} title={invitedTitle(inviter)}
      sub={t('Your training and your food in one place. Setting it up takes about a minute.')}
      lead={inviter && <div className="ob-disc g-glass" aria-hidden="true">{inviter[0].toUpperCase()}</div>}
      footer={<>
        <Button onClick={() => go('name', { replace: true })}>{t('Create my account')}</Button>
        <Button variant="ghost" onClick={signIn}>{t('I already have an account')}</Button>
      </>}>
      <GlassList items={[
        { icon: 'users', title: t('A small group') },
        { icon: 'lock', title: t('No password'), sub: t('Face ID or your fingerprint keeps you in') },
      ]} />
    </StepScreen>
  )
}
