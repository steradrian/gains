import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, hasData } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { copyText } from '../../../lib/clipboard.js'
import { t } from '../../../lib/i18n.js'
import { api, webauthnOK, passkeyRegister, passkeyError } from '../../../lib/api.js'
import { DEMO, REPO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { confirmSheet } from '../../../sheets.jsx'
import { Card } from '../../../components/blocks.jsx'
import { Spacer } from '../../../components/layout.jsx'
import { SheetHeader } from '../../../components/sheet-layout.jsx'
import { showsConnection, showsLocalLine } from '../../../components/SyncBanner.jsx'
import { ServerSyncSection, KeptChangesRows, connectServer, passkeySignIn } from '../../../components/ServerSync.jsx'
import { PasswordRow, openPasswordSignIn, openPasswordRegister } from '../../../components/PasswordAuth.jsx'
import { usePasskeys, PasskeysRow, DeviceLinkRow } from '../../../components/Passkeys.jsx'
import { Section, Row, Button, TextField } from '../../../components/ui.jsx'
import { openAddDevice } from '../../AddDevice.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { useAccountActions } from '../use-account-actions.js'

// The account's id, small and one tap to copy (#219). It is what an admin puts in ADMIN_UIDS,
// and the one thing that names an account beyond doubt when someone asks their admin for help:
// display names are free text and need not be unique. copyText also reaches the clipboard on a
// plain-http LAN address, where the Clipboard API is missing and password sign-in (#118) is the
// usual way in; where no copy works at all the id is still on screen to read out.
function AccountIdRow({ id }) {
  const toast = useUI(s => s.toast)
  if (!id) return null
  const copy = async () => { if (await copyText(id)) toast(t('Account ID copied')) }
  return <Row icon="personCircle" iconTint="var(--grey)" title={t('Account ID')} subtitle={<span className="acct-id">{id}</span>} onClick={copy} />
}

// Lets the mobile app's "connect to my server" mode (lib/remote.js) authenticate without a
// WebAuthn ceremony of its own — the code is minted here, from an already signed-in session,
// and redeemed by the app for a bearer token. See /api/pair/create in api/server.js.
function PairSheet({ close }) {
  const [code, setCode] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { api('/api/pair/create', { method: 'POST', body: '{}' }).then(r => setCode(r.code)).catch(e => setErr(e.message || t('Could not generate a code'))) }, [])
  return <>
    <SheetHeader title={t('Pair the mobile app')} />
    <div className="muted small mb-7">
      {t('On the Gains app, choose “Connect to my server”, then enter this address and the code below. It expires in 5 minutes.')}
    </div>
    {err ? <div className="dim small">{err}</div> : (
      <Card className="ta-center fs-big fw-bold" style={{ letterSpacing: '.16em', padding: '18px 0' }}>
        {code || '········'}
      </Card>
    )}
    <Spacer size={6} />
    <Button onClick={close}>{t('Done')}</Button>
  </>
}

// The same registration as the sign-in screen's, reached from Settings instead. It asks for
// the invite code on the same terms: an invite-only instance rejects a registration without
// one, so a form that cannot collect it is a form that cannot succeed.
function RegisterInline({ close, setUser, pushState, pullState, toast }) {
  const nameRef = useRef(null)
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = (nameRef.current.value || '').trim()
    if (!n) { toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim()); setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); toast(t('Profile created, and your data moved into it')) }
      else { await pullState(); toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') toast(passkeyError(e, t('Registration failed'))) }
  }
  return <>
    <SheetHeader title={t('Create your profile')} />
    <div className="muted small mb-7">{t('Pick a name, then confirm with your device.')}</div>
    <TextField ref={nameRef} placeholder={t('Your name')} maxLength={40} />
    {inviteOnly && <>
      <Spacer size={5} />
      <input className="input fw-semibold ta-center" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em' }} />
      <div className="dim small mt-3">{t('This app is invite-only. Enter the code you were given.')}</div>
    </>}
    <Spacer size={6} /><Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

export default function AccountPage() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)
  const pullState = useStore(s => s.pullState)
  const pushState = useStore(s => s.pushState)
  const resetDemo = useStore(s => s.resetDemo)
  const toast = useUI(s => s.toast)
  const { pwOn } = useSettingsCtx()
  const { signOutEverywhere } = useAccountActions()
  // This profile's passkeys and the code for another device (#95). A change to them is read back
  // here and by the password row, whose "Remove" depends on there being a passkey.
  const passkeys = usePasskeys(!!user && !MOBILE && !DEMO)
  const [credsV, setCredsV] = useState(0)
  const credsChanged = () => { passkeys.load(); setCredsV(v => v + 1) }
  const registerHere = () => useUI.getState().openSheet(close => <RegisterInline close={close} setUser={setUser} pushState={pushState} pullState={pullState} toast={toast} />)

  return <>
    {/* The server: which one, which account, how that stands. A paired phone's account id sits
        in the same block; a browser's account rows follow in their own. Sync now, Admin and
        Log out are on Profile itself. */}
    {user && !DEMO && <ServerSyncSection>
      {MOBILE && <AccountIdRow id={user.id} />}
    </ServerSyncSection>}

    {/* account (demo and mobile builds have nothing to sign in to) */}
    {!(MOBILE && user) && <Section title={MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')}>
      {MOBILE ? <>
        <Row icon="lock" iconTint="var(--acc)" title={t('All data stays on this phone')} subtitle={t('No account, no cloud. Back it up anytime under Backup.')} />
        <Row icon="cloud" iconTint="var(--indigo)" title={t('Connect to my server')} subtitle={t('Sync this device to your own self-hosted Gains instead.')} accessory="chevron"
          onClick={connectServer} />
        <KeptChangesRows />
      </> : DEMO ? <>
        <Row icon="info" iconTint="var(--acc)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser. Go wild and change anything you like.')} />
        <Row icon="reset" iconTint="var(--blue)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host Gains')} subtitle={t('Passkey sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>
        <PasskeysRow state={passkeys.st} changed={credsChanged} />
        <DeviceLinkRow state={passkeys.st} />
        <Row icon="qr" iconTint="var(--blue)" title={t('Pair the mobile app')} subtitle={t('Connect the Gains app on your phone to this account.')} accessory="chevron"
          onClick={() => useUI.getState().openSheet(close => <PairSheet close={close} />)} />
        {pwOn && <PasswordRow version={credsV} />}
        <Row icon="shield" iconTint="var(--red)" title={t('Sign out everywhere')} subtitle={t('Ends this profile’s sessions on all your devices.')} danger onClick={signOutEverywhere} />
        <AccountIdRow id={user.id} />
      </> : webauthnOK() ? <>
        <Row icon="plusCircle" iconTint="var(--acc)" title={t('Create passkey profile')} subtitle={t('Keeps your data safe and separate per person.')} accessory="chevron" onClick={registerHere} />
        <Row icon="fingerprint" iconTint="var(--blue)" title={t('Sign in with passkey')} accessory="chevron" onClick={passkeySignIn} />
        {/* The Login screen offers both of these; a guest who skipped it had no way to either from here. */}
        {pwOn && <Row icon="plusCircle" iconTint="var(--orange)" title={t('Create profile with a password')} accessory="chevron" onClick={openPasswordRegister} />}
        {pwOn && <Row icon="key" iconTint="var(--orange)" title={t('Sign in with password')} accessory="chevron" onClick={() => openPasswordSignIn()} />}
        <Row icon="qr" iconTint="var(--blue)" title={t('Use a code from your other device')} accessory="chevron" onClick={() => openAddDevice()} />
        <KeptChangesRows />
      </> : pwOn ? <>
        {/* No passkeys in this browser (plain http on a LAN address, say): a password is the way in. */}
        <Row icon="plusCircle" iconTint="var(--acc)" title={t('Create new profile')} subtitle={t('Keeps your data safe and separate per person.')} accessory="chevron" onClick={openPasswordRegister} />
        <Row icon="key" iconTint="var(--orange)" title={t('Sign in with password')} accessory="chevron" onClick={() => openPasswordSignIn()} />
        <KeptChangesRows />
      </> : <>
        <Row icon="lock" iconTint="var(--grey)" title={t('Passkeys not supported in this browser.')} />
        <KeptChangesRows />
      </>}
    </Section>}
    {/* The connection banner already says this to a guest; the line is for when it is switched
        off, or its × hid it (#454). */}
    {!user && !DEMO && !MOBILE && !(showsConnection(S) && showsLocalLine(S)) && <p className="sect-f mb-10" style={{ marginTop: -18 }}>{t('Guest mode: your data lives only in this browser.')}</p>}
  </>
}
