import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, passkeyError, bio } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { copyText } from '../lib/clipboard.js'
import { nav } from '../lib/nav.js'
import { openInBrowserLabel } from '../lib/open-in-browser.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { useState, useRef, useEffect } from 'react'
import { Button as AppButton, Segmented } from '../components/ui.jsx'
import { askAddDeviceData } from '../sheets.jsx'
import { passwordOn, PasswordRegisterForm, openPasswordSignIn } from '../components/PasswordAuth.jsx'
import { Spacer } from '../components/layout.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import SigninTroubleSheet from '../components/SigninTroubleSheet.jsx'
import Button from '../ds/Button.jsx'
import Illustration from '../ds/Illustration.jsx'
import Logo from '../ds/Logo.jsx'
import StageAlert from '../ds/StageAlert.jsx'
import StageFooter from '../ds/StageFooter.jsx'
import StageScreen from '../ds/StageScreen.jsx'
import { openAddDevice } from './AddDevice.jsx'
import '../signin.css'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState, loadConfig } = useStore()
  const config = useStore(s => s.config)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const inviteOnly = !!config?.invite_only
  // A password is offered only where the instance allows it (#118), and is the only choice in a
  // browser that cannot make a passkey. Where both work, the passkey stays the first one.
  const pwOn = passwordOn(config)
  const [how, setHow] = useState(webauthnOK() ? 'passkey' : 'password')
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  // Boot already fetched this; retry here only if that attempt failed, so the invite field still
  // appears on an instance whose config arrived late rather than never.
  useEffect(() => { loadConfig() }, [loadConfig])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created, and this device’s data moved into it')) }
      else {
        await pullState()
        // A new, empty profile on the web gets the first-run onboarding (goal, body, training,
        // plan), which sets up its targets in both apps; where there is no hub it is skipped.
        if (nutritionAvailable(u)) nav('/onboarding', { replace: true })
        else useUI.getState().toast(t('Welcome, {0}', u.name))
      }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(passkeyError(e, t('Registration failed'))) }
  }
  const choose = pwOn && webauthnOK() && <>
    <Segmented options={[{ value: 'passkey', label: t('Passkey'), icon: 'fingerprint' }, { value: 'password', label: t('Password'), icon: 'key' }]}
      value={how} onChange={setHow} />
    <Spacer size={6} />
  </>
  if (pwOn && how === 'password') return <>
    <SheetHeader title={t('Create your profile')} />
    {choose}
    <div className="muted small mb-7">{t('Pick a name and a password. You sign in with both.')}</div>
    <PasswordRegisterForm close={close} inviteOnly={inviteOnly} name={name} setName={setName} code={code} setCode={setCode} />
  </>
  return <>
    <SheetHeader title={t('Create your profile')} />
    {choose}
    <div className="muted small mb-7">{t('Pick a name, then confirm with {0}. The passkey lives on your device, so no password needed.', bio())}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <Spacer size={5} />
      <input className="input ls-14 fw-semibold ta-center" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} />
      <div className="dim small mt-3">{t('This app is invite-only. Enter the code you were given.')}</div>
    </>}
    <Spacer size={6} />
    <AppButton variant="primary" onClick={go}>{t('Create passkey')}</AppButton>
  </>
}

// A passkey prompt the person closed is their answer; the screen says the passkey was not confirmed.
const dismissed = e => e?.name === 'NotAllowedError' || e?.name === 'AbortError'

// The sign-in screen (S0.0–S0.3, S0.10) on the stage: where it stands is `at`, ready for a tap,
// waiting on the passkey prompt (S0.1), or failed (S0.2) with `n` counting the failures so each
// one is a new alert, which shakes and takes focus again. "Add this device" (S0.4–S0.6) is a route
// of its own (views/AddDevice.jsx); the password drawers (S0.7–S0.9) are sheets (components/PasswordAuth.jsx).
export default function Login() {
  const { setUser, adoptProfile, setGuest } = useStore()
  const config = useStore(s => s.config)
  const canGuest = guestAllowed(config)
  const pwOn = passwordOn(config)
  const inviteOnly = !!config?.invite_only
  const [at, setAt] = useState({ kind: 'ready' })
  // Which attempt is current, so a prompt that was cancelled and answers later changes nothing.
  const attempt = useRef(0)
  const prompt = useRef(null)
  const failures = useRef(0)
  const failed = message => setAt({ kind: 'failed', n: ++failures.current, message })
  const register = () => useUI.getState().openSheet(close => <RegisterSheet close={close} />)
  const signIn = async () => {
    if (at.kind === 'waiting') return
    const id = ++attempt.current
    const ctl = new AbortController()
    prompt.current = ctl
    setAt({ kind: 'waiting' })
    let u
    try { u = await passkeyLogin({ signal: ctl.signal }) }
    catch (e) {
      if (id !== attempt.current) return
      failed(dismissed(e) ? t('Your passkey could not be confirmed.') : passkeyError(e, t('Sign-in failed')))
      return
    }
    if (id !== attempt.current) return
    setUser(u, { adopt: true })
    try { await adoptProfile(askAddDeviceData); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { useUI.getState().toast(passkeyError(e, t('Sign-in failed'))) }
  }
  const cancel = () => {
    attempt.current++
    prompt.current?.abort()
    failed(t('Your passkey could not be confirmed.'))
  }
  const trouble = () => useUI.getState().openSheet(close => (
    <SigninTroubleSheet close={close} onCode={() => openAddDevice(close)}
      onPassword={pwOn ? () => { close(); openPasswordSignIn(signIn) } : null} />
  ))
  const copyLink = async () => {
    const ok = await copyText(window.location.origin + window.location.pathname)
    useUI.getState().toast(ok ? t('Link copied') : t('Could not copy the link'))
  }
  // The ways in the boards do not draw but the instance may offer: a new profile where it is not
  // invite-only (the invite link is how people arrive there), and the guest profile.
  const others = <>
    {!inviteOnly && <Button block variant="ghost" onClick={register}>{t('Create new profile')}</Button>}
    {canGuest && <Button block variant="ghost" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>}
  </>
  const screen = (body, footer) => (
    <StageScreen>
      <div className="si-col">
        {body}
        <div className="si-foot"><StageFooter sticky={false}>{footer}</StageFooter></div>
      </div>
    </StageScreen>
  )

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return screen(<>
    <div className="si-top">
      <Logo size={56} color="var(--on-stage)" />
      <p>{t('Live demo. Everything stays in this browser.')}</p>
    </div>
    <p className="si-note">
      {t('This demo runs entirely in your browser on example data. Nothing is sent anywhere. Passkey sign-in and sync across your devices come with the Gains server, which you get by self-hosting it.')}
    </p>
  </>, <>
    <Button block icon="play" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
    <Button block variant="ghost" href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</Button>
  </>)

  // Plain http on a LAN address, or a browser without passkey support (S0.10): the password is the
  // way in where the instance has one, and the link opens the app where a passkey can be made.
  if (!webauthnOK()) return screen(<>
    <div className="si-head si-head-far">
      <h1>{t('This browser can’t use passkeys')}</h1>
      <p>{t('Some apps open links in their own browser, which can’t save or use a passkey. Open Gains in Safari or Chrome instead.')}</p>
    </div>
    <div className="si-art" aria-hidden="true"><Illustration name="passkey" tone="stage" draw="once" width={260} /></div>
  </>, <>
    <Button block icon="copy" onClick={copyLink}>{openInBrowserLabel()}</Button>
    {pwOn && <Button block variant="glass" onClick={() => openPasswordSignIn()}>{t('Sign in with password')}</Button>}
    {others}
  </>)

  const head = <>
    <div className="si-top">
      <Logo size={56} color="var(--on-stage)" />
      <h1>{t('Welcome back')}</h1>
      <p>{t('Your training and your food in one place.')}</p>
    </div>
    <div className="si-art" aria-hidden="true"><Illustration name="passkey" tone="stage" draw="once" width={260} /></div>
  </>

  if (at.kind === 'waiting') return screen(head, <>
    <Button block busy>{t('Waiting for your passkey')}</Button>
    <Button block variant="ghost" onClick={cancel}>{t('Cancel')}</Button>
  </>)

  const failedNow = at.kind === 'failed'
  return screen(<>
    {head}
    {inviteOnly && !failedNow && <p className="si-note">{t('Gains is invite-only. New here? Open the invite link a friend sent you.')}</p>}
  </>, <>
    {failedNow && <StageAlert key={at.n} action={t('Having trouble?')} onAction={trouble}>{at.message}</StageAlert>}
    <Button block icon="scanFace" onClick={signIn}>{failedNow ? t('Try again') : t('Sign in with passkey')}</Button>
    <Button block variant="glass" icon="smartphone" onClick={() => openAddDevice()}>{t('Use a code from your other device')}</Button>
    {pwOn && <Button block variant="ghost" onClick={() => openPasswordSignIn(signIn)}>{t('Sign in with password')}</Button>}
    {others}
  </>)
}
