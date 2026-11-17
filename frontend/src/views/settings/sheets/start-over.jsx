import { t } from '../../../lib/i18n.js'
import { bodyLine, mediaLine, profileCounts, trainingLine } from '../profile-counts.js'
import { confirmDrawer } from '../confirm-drawer.js'

/* A2.9 Start over (board St2StartOver; owner decision Q11: today's reset, unchanged). The store's
   resetEverything replaces the whole profile with a new one in the language on screen
   (useStore restartedState): every entry, the Plan, the running workout and every setting but the
   language go, signed in on the server and every device that syncs with it too, and the photos,
   videos and Coach data after it (use-account-actions.js). There is no Undo, and nothing keeps a
   copy. The confirm lists exactly that, counted from this profile; a part with nothing in it is
   left out. NutriTrace's diary is not Gains' to wipe, and the account and passkeys stay. */
export function startOverItems(S) {
  const c = profileCounts(S)
  return [
    trainingLine(c),
    bodyLine(c),
    mediaLine(c),
    S?.active && t('The workout you have running'),
    t('Your settings, gym setup and notes. The language stays.'),
  ].filter(Boolean)
}

// `deletion`: the account is scheduled for deletion. The server takes no writes then, so the empty
// state reaches it only if the deletion is cancelled; if not, the purge removes the server copy.
export const confirmStartOver = ({ S, signedIn, deletion, server, nutrition, onConfirm }) => confirmDrawer({
  title: t('Start over?'),
  body: signedIn && deletion
    ? t('This wipes what you logged on this device. Your server copy goes when the scheduled deletion runs, and your other devices keep theirs until then. It cannot be undone.')
    : signedIn
      ? t('This wipes what you logged, here and on every device signed in to your profile. It cannot be undone.')
      : t('This wipes what you logged on this device. It cannot be undone.'),
  items: startOverItems(S),
  note: [
    signedIn && !deletion && t('Your account and passkeys stay.'),
    nutrition && t('Your nutrition diary, foods and goals stay.'),
    server ? t('Download my data first if you might want it.') : t('Export a backup first if you might want any of it back.'),
  ].filter(Boolean).join(' '),
  icon: 'reset',
  confirmLabel: t('Start over'),
  onConfirm,
})
