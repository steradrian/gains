import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import StageArt from '../../components/onboarding/StageArt.jsx'
import StepScreen from '../../components/onboarding/StepScreen.jsx'
import TroubleSheet from '../../components/onboarding/TroubleSheet.jsx'
import Button from '../../ds/Button.jsx'
import StageAlert from '../../ds/StageAlert.jsx'
import { passkeyError, passkeyRegister, webauthnOK } from '../../lib/api.js'
import { t } from '../../lib/i18n.js'
import { useOnboarding } from '../../lib/onboarding/contexts.js'
import { pathOf } from '../../lib/onboarding/flow.js'
import { hasData, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// 1 Name + passkey (§3 screen 1; boards O2.1, O2.1e): the name, prefilled with the one the inviter
// suggested, at most 30 characters, and the passkey made with the invite's code. Create passkey
// stays dimmed until there is a name. Cancelling the prompt says so in the footer's alert (in the
// reassurance line's place), which shakes once, with "Having trouble?" (§6), and nothing is lost:
// the button just works again. The key's shaft is where the thread lands, as a blade.
const NAME_MAX = 30

export default function NameScreen() {
  const { state, act, go } = useOnboarding()
  const [name, setName] = useState(() => state.name ?? state.invite?.suggestedName ?? '')
  const [busy, setBusy] = useState(false)
  // { n, message }: a new n for each failure, so the alert arrives (and shakes) again.
  const [problem, setProblem] = useState(null)
  const inviter = state.invite?.status === 'valid' ? state.invite.inviterName : null
  const ok = !!name.trim() && !busy

  // Signed in already (a reload after the passkey): there is no second account to make here.
  const signedIn = useStore(s => !!s.user)
  if (signedIn && !busy) return <Navigate to="/onboarding" replace />
  // The invite this account is made with is the one the landing checked in this tab. With none (the
  // address typed in, an invite left behind) there is nothing to make an account with: the landing.
  if (!state.code) return <Navigate to={pathOf('invite', null)} replace />

  const fail = message => setProblem(p => ({ n: (p?.n ?? 0) + 1, message }))
  const trouble = () => useUI.getState().openSheet(close => <TroubleSheet close={close} code={state.code} />)
  const create = async () => {
    if (!ok) return
    if (!webauthnOK()) { fail(t('This browser can’t make a passkey.')); return }
    setProblem(null)
    setBusy(true)
    try {
      const u = await passkeyRegister(name.trim(), state.code)
      // On first, then signed in: the layout lets a signed-in person past the name step only forward.
      go('passkey', { replace: true })
      const store = useStore.getState()
      store.setUser(u)
      if (hasData(store.S)) store.pushState()
      else store.pullState()
    } catch (e) {
      setBusy(false)
      fail(e.name === 'NotAllowedError' || e.name === 'AbortError'
        ? t('No passkey created. Try again.')
        : passkeyError(e, t('Registration failed')))
    }
  }
  return (
    <StepScreen titleId="ob-name-t" title={t('What should we call you?')}
      sub={inviter ? t('{0} and your other friends on Gains will see this name.', inviter) : t('Your friends on Gains will see this name.')}
      stage={<StageArt name="passkey" anchor="shaft" form="blade" width={300} />}
      footerNote={!problem && <><Icon name="keyRound" className="g-icon" /><span>{t('No password to remember. Face ID or your fingerprint keeps your account safe.')}</span></>}
      footer={<>
        {problem && <StageAlert key={problem.n} action={t('Having trouble?')} onAction={trouble}>{problem.message}</StageAlert>}
        <Button icon="scanFace" busy={busy} disabled={!name.trim()} onClick={create}>{t('Create passkey')}</Button>
      </>}>
      <label className="ob-name g-glass">
        <span>{t('Your name')}</span>
        <input type="text" autoComplete="given-name" enterKeyHint="go" maxLength={NAME_MAX} value={name}
          onChange={e => { setName(e.target.value); act({ type: 'name', name: e.target.value }) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create() } }} />
      </label>
    </StepScreen>
  )
}
