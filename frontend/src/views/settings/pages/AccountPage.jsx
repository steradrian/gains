import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, hasData } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { copyText } from '../../../lib/clipboard.js'
import { t } from '../../../lib/i18n.js'
import { api, webauthnOK, passkeyRegister, passkeyError } from '../../../lib/api.js'
import { DEMO, REPO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { deletionDay } from '../../../lib/account-deletion.js'
import { confirmSheet } from '../../../sheets.jsx'
import { showsConnection, showsLocalLine } from '../../../components/SyncBanner.jsx'
import { ServerSyncSection, KeptChangesRows, connectServer, connectionView, passkeySignIn, signInAgain } from '../../../components/ServerSync.jsx'
import { PasswordRow, openPasswordSignIn, openPasswordRegister } from '../../../components/PasswordAuth.jsx'
import { usePasskeys, listOf } from '../../../components/Passkeys.jsx'
import { Section } from '../../../components/ui.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DangerRow from '../../../ds/DangerRow.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import TextField from '../../../ds/TextField.jsx'
import { openAddDevice } from '../../AddDevice.jsx'
import { openPasskeySheet, openAddPasskey, passkeyLabel, passkeyMeta } from '../sheets/passkey-sheets.jsx'
import { openAddDeviceSheet, openPairSheet } from '../sheets/add-device-sheet.jsx'
import { openDownloadSheet } from '../sheets/download-sheet.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { useAccountActions } from '../use-account-actions.js'
import { SETTINGS_ROOT, settingsPath } from '../paths.js'
import SettingsPage from '../SettingsPage.jsx'

// A list of rows in one glass card, the stage's (GlassValueRow rows).
const Card = ({ children }) => <div className="g-glist g-glass">{children}</div>

// The account's id, small and one tap to copy (#219). It is what an admin puts in ADMIN_UIDS,
// and the one thing that names an account beyond doubt when someone asks their admin for help:
// display names are free text and need not be unique. copyText also reaches the clipboard on a
// plain-http LAN address, where the Clipboard API is missing and password sign-in (#118) is the
// usual way in; where no copy works at all the id is still on screen to read out.
function AccountIdRow({ id }) {
  const toast = useUI(s => s.toast)
  if (!id) return null
  const copy = async () => { if (await copyText(id)) toast(t('Account ID copied')) }
  return <GlassValueRow icon="personCircle" title={t('Account ID')} sub={<span className="acct-id">{id}</span>} onClick={copy} chevron={false} />
}

// The same registration as the sign-in screen's, reached from Settings instead. It asks for
// the invite code on the same terms: an invite-only instance rejects a registration without
// one, so a form that cannot collect it is a form that cannot succeed.
function RegisterInline({ close, setUser, pushState, pullState, toast }) {
  const nameRef = useRef('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = nameRef.current.trim()
    if (!n) { toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim()); setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); toast(t('Profile created, and your data moved into it')) }
      else { await pullState(); toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') toast(passkeyError(e, t('Registration failed'))) }
  }
  return (
    <BottomSheet title={t('Create your profile')} onClose={close}>
      <div className="g-acct-sheet">
        <p className="g-acct-p">{t('Pick a name, then confirm with your device.')}</p>
        <TextField label={t('Your name')} placeholder={t('Your name')} onChange={v => { nameRef.current = v }} inputProps={{ maxLength: 40 }} />
        {inviteOnly && <>
          <TextField label={t('Invite code')} placeholder={t('Invite code')} onChange={v => setCode(v.toUpperCase())} inputProps={{ maxLength: 40 }} />
          <p className="g-acct-p g-acct-quiet">{t('This app is invite-only. Enter the code you were given.')}</p>
        </>}
        <Button onClick={go}>{t('Create passkey')}</Button>
      </div>
    </BottomSheet>
  )
}

export default function AccountPage() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const setUser = useStore(s => s.setUser)
  const pullState = useStore(s => s.pullState)
  const pushState = useStore(s => s.pushState)
  const resetDemo = useStore(s => s.resetDemo)
  const toast = useUI(s => s.toast)
  const { pwOn, hasMedia } = useSettingsCtx()
  const { signOutEverywhere, startOver } = useAccountActions()
  // This profile's passkeys and the code for another device (#95). A change to them is read back
  // here and by the password row, whose "Remove" depends on there being a passkey.
  const passkeys = usePasskeys(!!user && !MOBILE && !DEMO)
  const [credsV, setCredsV] = useState(0)
  const st = passkeys.st
  const done = r => { passkeys.set(listOf(r) || st); passkeys.load(); setCredsV(v => v + 1) }
  const registerHere = () => useUI.getState().openSheet(close => <RegisterInline close={close} setUser={setUser} pushState={pushState} pullState={pullState} toast={toast} />, { variant: 'ds' })
  const server = !!user && !MOBILE && !DEMO
  const connection = connectionView(sync)

  return <SettingsPage title={t('Account and data')} line={server ? t('Passkeys, devices and your data') : undefined}>
    <div className="g-acct">
    {server && <>
      <div className="g-acct-card g-glass">
        <span className="g-acct-ava" aria-hidden="true">{[...(user.name || '?')][0].toUpperCase()}</span>
        <span className="g-acct-who"><b>{user.name}</b><span>{user.admin ? t('Admin') : t('Member')}</span></span>
      </div>

      {st && <>
        <StageSection title={t('Passkeys')} />
        <Card>
          {st.passkeys.map((p, i) => <GlassValueRow key={p.id} icon="fingerprint" title={passkeyLabel(p, i)} sub={passkeyMeta(p) || undefined}
            onClick={() => openPasskeySheet({ passkey: p, title: passkeyLabel(p, i), state: st, done })} />)}
          {webauthnOK() && <GlassValueRow icon="plus" title={t('Add a passkey')}
            sub={st.passkeys.length === 0 ? t('None yet. Add one and sign in without your password.') : t('Another way in, on another device')}
            onClick={() => openAddPasskey({ state: st, done })} />}
        </Card>
      </>}

      <StageSection title={t('Devices')} />
      <Card>
        {st && <GlassValueRow icon="qr" title={t('Add another device')} sub={t('A one-time code for your phone or another computer')}
          onClick={() => openAddDeviceSheet({ state: st })} />}
        <GlassValueRow icon="qr" title={t('Pair the mobile app')} sub={t('Connect the Gains app on your phone to this account.')} onClick={openPairSheet} />
        <GlassValueRow icon="shield" title={t('Sign out everywhere')} sub={t('Ends this profile’s sessions on all your devices.')} onClick={signOutEverywhere} />
      </Card>
      {pwOn && <Section><PasswordRow version={credsV} /></Section>}

      <StageSection title={t('Your data')} />
      <Card>
        {/* The server ended this browser's session: the way back in, where the connection block used to offer it. */}
        {sync?.status === 'auth' && (webauthnOK() || pwOn) && (
          <GlassValueRow icon={pwOn ? 'person' : 'fingerprint'} title={pwOn ? t('Sign in') : t('Sign in with passkey')}
            sub={t('Your changes are kept here, and merged into your account once you are signed in again.')} onClick={signInAgain} />
        )}
        <GlassValueRow icon="download" title={t('Download my data')}
          sub={hasMedia ? t('Everything, as JSON and a .zip of photos') : t('Everything, as a JSON file')} onClick={openDownloadSheet} />
        <GlassValueRow icon="folder" title={t('Import')} onClick={() => nav(settingsPath('import'))} />
        <GlassValueRow icon={connection?.icon || 'cloud'} title={t('Sync and backup')} sub={connection?.line} onClick={() => nav(settingsPath('backup'))} />
        <AccountIdRow id={user.id} />
      </Card>
      <KeptChangesRows />
    </>}

    {/* A phone paired with a server: the connection block, then the account's id. */}
    {MOBILE && user && !DEMO && <>
      <ServerSyncSection />
      <Card><AccountIdRow id={user.id} /></Card>
    </>}

    {/* Demo, phone-only and guest builds have nothing to sign in to or only a way in. */}
    {!server && !(MOBILE && user) && <>
      <StageSection title={MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')} />
      <Card>
        {MOBILE ? <>
          <GlassValueRow icon="lock" static title={t('All data stays on this phone')} sub={t('No account, no cloud. Back it up anytime under Backup.')} />
          <GlassValueRow icon="cloud" title={t('Connect to my server')} sub={t('Sync this device to your own self-hosted Gains instead.')} onClick={connectServer} />
        </> : DEMO ? <>
          <GlassValueRow icon="info" static title={t('You’re in the demo')} sub={t('Example data, stored only in this browser. Go wild and change anything you like.')} />
          <GlassValueRow icon="reset" title={t('Reset demo data')}
            onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
          <GlassValueRow icon="rocket" title={t('Self-host Gains')} sub={t('Passkey sign-in, sync across your devices, your own data.')} onClick={() => window.open(REPO, '_blank', 'noopener')} />
        </> : webauthnOK() ? <>
          <GlassValueRow icon="plusCircle" title={t('Create passkey profile')} sub={t('Keeps your data safe and separate per person.')} onClick={registerHere} />
          <GlassValueRow icon="fingerprint" title={t('Sign in with passkey')} onClick={passkeySignIn} />
          {/* The Login screen offers both of these; a guest who skipped it had no way to either from here. */}
          {pwOn && <GlassValueRow icon="plusCircle" title={t('Create profile with a password')} onClick={openPasswordRegister} />}
          {pwOn && <GlassValueRow icon="key" title={t('Sign in with password')} onClick={() => openPasswordSignIn()} />}
          <GlassValueRow icon="qr" title={t('Use a code from your other device')} onClick={() => openAddDevice()} />
        </> : pwOn ? <>
          {/* No passkeys in this browser (plain http on a LAN address, say): a password is the way in. */}
          <GlassValueRow icon="plusCircle" title={t('Create new profile')} sub={t('Keeps your data safe and separate per person.')} onClick={openPasswordRegister} />
          <GlassValueRow icon="key" title={t('Sign in with password')} onClick={() => openPasswordSignIn()} />
        </> : (
          <GlassValueRow icon="lock" static title={t('Passkeys not supported in this browser.')} />
        )}
      </Card>
      <KeptChangesRows />
      {/* The connection banner already says this to a guest; the line is for when it is switched
          off, or its × hid it (#454). */}
      {!user && !DEMO && !MOBILE && !(showsConnection(S) && showsLocalLine(S)) && <StageNote>{t('Guest mode: your data lives only in this browser.')}</StageNote>}
    </>}

    {/* Every build can start over (it was the Danger zone page); only a browser signed in to its
        server can delete the account, which the server keeps for seven days first. */}
    <StageSection title={t('Start again')} />
    <Card>
      <DangerRow icon="reset" title={t('Start over')} sub={t('Wipe what you logged and your settings')} onClick={startOver} />
      {server && <DangerRow icon="trash" first={false} title={t('Delete account')}
        sub={user.deletion ? t('Scheduled for {0}', deletionDay(user.deletion.at)) : t('Everything, after 7 days')}
        onClick={() => nav(user.deletion ? SETTINGS_ROOT : settingsPath('account/delete'))} />}
    </Card>
    </div>
  </SettingsPage>
}
