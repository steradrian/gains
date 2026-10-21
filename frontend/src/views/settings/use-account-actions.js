import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { api } from '../../lib/api.js'
import { forgetCoach } from '../../lib/coach-api.js'
import { mediaStore } from '../../lib/media-store.js'
import { confirmSheet } from '../../sheets.jsx'
import { leaveServer } from '../../components/ServerSync.jsx'
import { useDataActions } from './use-data-actions.js'

/* After "Reset training data": the photos and videos go too. Signed in, the empty state is pushed
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
 * Disconnect (phone), Sign out, Sign out everywhere and Reset training data: the confirms and
 * what they do, as Settings always had them.
 *
 * None of the sign-outs wipes this device while the server is missing a change: the confirm no
 * longer promises a sync it never checked, and when something is owed, a second sheet says how
 * much and offers to try again, to export a backup, or to go ahead anyway with the changes kept
 * on this device (components/ServerSync.jsx). "Sign out everywhere" also ends every paired
 * phone's token — the phones have no passkey to sign in with, so they have to be paired again,
 * and the confirm says so. Failing, it touches nothing local: still signed in here, and the
 * toast says so.
 */
export function useAccountActions() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const coachLocal = useStore(s => s.coachLocal)
  const resetAll = useStore(s => s.resetEverything)
  const toast = useUI(s => s.toast)
  const { doExport, doExportZip } = useDataActions()

  const kept = t('The changes your server has not seen are kept on this device, and added back when it connects as this account again.')
  // A workout running here is kept aside by the sign-out (useStore stashActive): the confirm says so.
  const running = () => S.active ? ' ' + t('You have a workout running. It waits on this device until you’re back on this account.') : ''
  const leave = (kind, after) => leaveServer(kind, { exportBackup: doExport, exportBackupZip: doExportZip, done: r => { nav('/home'); if (r.stashed) toast(kept); else if (after) toast(after) } })
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
    onConfirm: () => leave('signout'),
  })
  const signOutEverywhere = () => confirmSheet({
    title: t('Sign out everywhere?'),
    message: t('Signs this profile out on every device, including this one. Phones paired with it are disconnected and have to be paired again. Your passkeys keep working, so you can sign in with them again anytime.') + running(),
    confirmText: t('Sign out everywhere'), danger: true,
    onConfirm: () => leave('everywhere', t('Signed out on all devices')),
  })
  // Signed in, the empty state is pushed to the profile like any other change, so the wipe
  // reaches the server and every device that syncs with it — the dialog has to say so. The Coach
  // keeps its data outside S in two homes that can both be in use on one phone: a file per
  // profile on the server, and — when it runs with the phone's own key — a file on the device.
  // Each is cleared on its own; forgetCoach() alone would pick one by mode. A failed call must
  // not stop the reset.
  // Training data only: NutriTrace's diary, foods and goals are not Gains' to wipe.
  const resetEverything = () => confirmSheet({
    title: t('Reset training data?'),
    message: user
      ? t('Deletes your plan, workouts, body weight, photos and videos from your profile on this server and on every signed-in device. This cannot be undone.')
      : t('Deletes your plan, workouts, body weight, photos and videos on this device. This cannot be undone.'),
    confirmText: t('Delete training data'), danger: true,
    onConfirm: () => {
      if (user) api('/api/coach/forget', { method: 'POST', body: '{}' }).catch(() => {})
      if (coachLocal?.mode === 'byok') forgetCoach().catch(() => {})
      resetAll()
      nav('/home'); toast(t('Training data reset'))
      clearMediaAfterReset(!!user).catch(() => {})
    },
  })

  return { disconnect, signOutHere, signOutEverywhere, resetEverything }
}
