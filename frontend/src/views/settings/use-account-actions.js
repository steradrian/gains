import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { api } from '../../lib/api.js'
import { forgetCoach } from '../../lib/coach-api.js'
import { DEMO } from '../../lib/demo.js'
import { MOBILE } from '../../lib/mobile.js'
import { mediaStore } from '../../lib/media-store.js'
import { whenSheetGone } from '../../lib/nav.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { confirmSheet } from '../../sheets.jsx'
import { leaveServer } from '../../components/ServerSync.jsx'
import { useDataActions } from './use-data-actions.js'
import { settingsPath } from './paths.js'
import { confirmSignOutEverywhere, keptNote, signOutWaiting } from './sheets/sign-out-sheets.js'
import { confirmStartOver } from './sheets/start-over.jsx'

// Where Start over lands (A2.10, pages/StartedOverScreen.jsx).
const STARTED_OVER = settingsPath('account/started-over')

/* After Start over: the photos and videos go too. Signed in, the empty state is pushed
   first and, once the server holds it, the server is asked to drop every file that state no
   longer refers to (POST /api/media/sweep) — asked before the push landed, it would still see the
   old state and keep everything, which is the safe side. Then this device keeps only the files a
   stash refers to: another account's changes kept here are not this reset's to delete. */
async function clearMediaAfterReset(signedIn) {
  const st = useStore.getState()
  if (signedIn && typeof st.pushState === 'function') {
    await st.pushState()
    const now = useStore.getState()
    if (now.sync?.status === 'ok' && now.config?.media) await api('/api/media/sweep', { method: 'POST', body: '{}' }).catch(() => {})
  }
  const keep = typeof st.stashedMediaHashes === 'function' ? await st.stashedMediaHashes() : new Set()
  await mediaStore.retainOnly(keep)
}

/**
 * Disconnect (phone), Sign out, Sign out everywhere and Start over: the confirms and
 * what they do, as Settings always had them.
 *
 * None of the sign-outs wipes this device while the server is missing a change: the confirm no
 * longer promises a sync it never checked. When something is owed, a browser's Sign out and Sign
 * out everywhere ask with a drawer that says how much (sheets/sign-out-sheets.js, A2.6) and offer
 * Sign out anyway, with the changes kept on this device; the phone's Disconnect keeps the sheet
 * that also offers a retry and a backup (components/ServerSync.jsx). "Sign out everywhere" also
 * ends every paired phone's token — the phones have no passkey to sign in with, so they have to
 * be paired again, and the confirm (A2.5) says so. Failing, it touches nothing local: still
 * signed in here, and the toast says so.
 */
export function useAccountActions() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const coachLocal = useStore(s => s.coachLocal)
  const resetAll = useStore(s => s.resetEverything)
  const toast = useUI(s => s.toast)
  const { doExport, doExportZip } = useDataActions()

  // A workout running here is kept aside by the sign-out (useStore stashActive): the confirm says so.
  const running = () => S.active ? ' ' + t('You have a workout running. It waits on this device until you’re back on this account.') : ''
  // Through whenSheetGone: the confirm that led here closes in the same handler, and a page change
  // written before its history entry is walked off leaves that entry under the new page.
  const finish = after => r => { whenSheetGone(() => nav('/home')); if (r.stashed) toast(keptNote()); else if (after) toast(after) }
  const leave = (kind, after) => leaveServer(kind, { exportBackup: doExport, exportBackupZip: doExportZip, done: finish(after) })
  // A browser's sign-outs ask with the drawer (A2.6) when the server is missing changes; the
  // phone's Disconnect keeps the sheet that offers a retry and a backup.
  const leaveAsking = (kind, after) => leaveServer(kind, {
    done: finish(after),
    onOwed: r => signOutWaiting({ kind, count: r.count, media: r.media || 0, done: finish(after) }),
  })
  const disconnect = () => confirmSheet({
    title: t('Disconnect from your server?'),
    message: t('This phone switches back to local-only and its copy of your account is removed. First it checks that your server has every change. If not, you choose what happens to them.') + running(),
    confirmText: t('Disconnect'), danger: true,
    onConfirm: () => leave('disconnect', t('Disconnected. Back to local-only')),
  })
  const signOutHere = () => confirmSheet({
    title: t('Sign out?'),
    message: t('Your data is removed from this browser; your profile on the server keeps it. First it checks that the server has every change. If not, you choose what happens to them.') + running(),
    confirmText: t('Sign out'), danger: true,
    onConfirm: () => leaveAsking('signout'),
  })
  const signOutEverywhere = () => confirmSignOutEverywhere({
    running: running(),
    onConfirm: () => leaveAsking('everywhere', t('Signed out on all devices')),
  })
  // Start over (A2.9, sheets/start-over.jsx). Signed in, the empty state is pushed to the profile
  // like any other change, so the wipe reaches the server and every device that syncs with it —
  // the confirm has to say so. The Coach keeps its data outside S in two homes that can both be in
  // use on one phone: a file per profile on the server, and — when it runs with the phone's own
  // key — a file on the device. Each is cleared on its own; forgetCoach() alone would pick one by
  // mode. A failed call must not stop the reset. NutriTrace's diary, foods and goals are not
  // Gains' to wipe. It lands on Started over (A2.10).
  const startOver = () => confirmStartOver({
    S,
    signedIn: !!user,
    deletion: !!user?.deletion,
    server: !!user && !MOBILE && !DEMO,
    nutrition: nutritionAvailable(user),
    onConfirm: () => {
      if (user) api('/api/coach/forget', { method: 'POST', body: '{}' }).catch(() => {})
      if (coachLocal?.mode === 'byok') forgetCoach().catch(() => {})
      resetAll()
      whenSheetGone(() => nav(STARTED_OVER))
      clearMediaAfterReset(!!user).catch(() => {})
    },
  })

  return { disconnect, signOutHere, signOutEverywhere, startOver }
}
