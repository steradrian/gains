import { Navigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t, tn } from '../../../lib/i18n.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { GRACE_DAYS, deletionDay, graceEnd } from '../../../lib/account-deletion.js'
import { usePasskeys } from '../../../components/Passkeys.jsx'
import Button from '../../../ds/Button.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StagePageTitle from '../../../ds/StagePageTitle.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import { openDownloadSheet } from '../sheets/download-sheet.jsx'
import { bodyLine, mediaLine, profileCounts, trainingLine } from '../profile-counts.js'
import { useDeleteAccount } from '../use-delete-account.js'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { SETTINGS_ROOT, settingsPath } from '../paths.js'

const ACCOUNT = settingsPath('account')
const Card = ({ children }) => <div className="g-glist g-glass">{children}</div>

/* A3.0 Delete account (/me/account/delete), for a browser signed in to its server: what goes,
   counted from this profile, what happens in the seven days, Download my data, then Delete my
   account behind the passkey (A3.1, use-delete-account.js). A line the app has no count for is
   left out. Food is not on the list: the diary lives with NutriTrace, which this deletion does not
   reach, and the page says so. A deletion already pending is the root's banner, not this page.
   App.jsx routes here directly (no Settings page host), so it draws the stage page itself. */
export default function DeleteAccountPage() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { nutrition, hasMedia, pwOn } = useSettingsCtx()
  const server = !!user && !MOBILE && !DEMO
  const { st } = usePasskeys(server)
  const { start, busy } = useDeleteAccount()
  if (!server) return <Navigate to={ACCOUNT} replace />
  if (user.deletion) return <Navigate to={SETTINGS_ROOT} replace />

  const c = profileCounts(S)
  const day = deletionDay(graceEnd())
  const passkeys = st ? st.passkeys.length : 0
  const signIn = st ? [passkeys > 0 && tn('{0} passkey', '{0} passkeys', passkeys), st.password && t('your password')].filter(Boolean).join(', ') : ''
  const goes = [
    { icon: 'dumbbell', title: t('Training'), sub: trainingLine(c) },
    { icon: 'scale', title: t('Body'), sub: bodyLine(c) },
    { icon: 'camera', title: t('Photos'), sub: mediaLine(c) },
    { icon: 'fingerprint', title: t('Sign-in'), sub: signIn },
    { icon: 'slider', title: t('Settings'), sub: t('Your settings and gym setup') },
  ].filter(r => r.sub)
  // The proof the server will ask for: a passkey when the profile has one, else its password.
  const proof = passkeys === 0 && st?.password && pwOn
    ? t('Gains asks for your password to make sure it’s you.')
    : t('Gains asks for your passkey to make sure it’s you.')

  return <StagePage parent={ACCOUNT}>
    <StagePageTitle title={t('Delete account')} line={t('Everything below goes, after {0} days', GRACE_DAYS)} />
    <div className="g-acct">
      <StageSection title={t('What goes')} />
      <Card>{goes.map(r => <GlassValueRow key={r.title} static icon={r.icon} title={r.title} sub={r.sub} />)}</Card>
      {nutrition && <StageNote>{t('Your food diary lives with NutriTrace and is not deleted with your account.')}</StageNote>}

      <StageSection title={t('What happens')} />
      <Card>
        <GlassValueRow static icon="calendar" title={t('{0} days to change your mind', GRACE_DAYS)} sub={t('Sign in before {0} and tap Cancel deletion', day)} />
        <GlassValueRow static icon="cloudSlash" title={t('Sync pauses')} sub={t('Until then nothing syncs. What you change stays on this device.')} />
        <GlassValueRow static icon="trash" title={t('After {0} days', GRACE_DAYS)} sub={t('Deleted from the server for good')} />
      </Card>

      <StageSection title={t('Before you go')} />
      <Card>
        <GlassValueRow icon="download" title={t('Download my data')}
          sub={hasMedia ? t('Everything, as JSON and a .zip of photos') : t('Everything, as a JSON file')} onClick={openDownloadSheet} />
      </Card>
      <div className="g-acct-del">
        <Button variant="danger" block icon="trash" busy={busy} onClick={start}>{t('Delete my account')}</Button>
      </div>
      <StageNote>{proof}</StageNote>
    </div>
  </StagePage>
}
