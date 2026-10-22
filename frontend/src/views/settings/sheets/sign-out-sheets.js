import { t, tn } from '../../../lib/i18n.js'
import { changeCount } from '../../../lib/format.js'
import { leaveServer } from '../../../components/ServerSync.jsx'
import { confirmDrawer } from '../confirm-drawer.js'

/* The two R5 confirms of signing out (boards St2SignOutAll and St2SignOutWaiting). Both open
   through confirmDrawer, so from inside a drawer they are sub-panels. What signing out does is the
   store's, through leaveServer (components/ServerSync.jsx): it never wipes a device that holds
   changes the server has not seen, and going ahead anyway keeps them aside on this device. */

// What "Sign out anyway" leaves behind, said wherever a sign-out may have changes in hand.
export const keptNote = () => t('The changes your server has not seen are kept on this device, and added back when it connects as this account again.')

// A2.5. The sign-out ends this device's session too (the server bumps the session version), so the
// copy says "including this one"; `running` is the workout-kept-aside sentence, when there is one.
export const confirmSignOutEverywhere = ({ running = '', onConfirm }) => confirmDrawer({
  title: t('Sign out everywhere?'),
  body: t('Signs this profile out on every device, including this one. Phones paired with it are disconnected and have to be paired again. Your passkeys keep working, so you can sign in with them again anytime.') + running,
  icon: 'signOut',
  confirmLabel: t('Sign out everywhere'),
  onConfirm,
})

// A2.6: the server was not up to date when the sign-out asked. `count` and `media` are the store's
// (unsyncedChanges); it knows how many changes there are, not their names, so none are listed.
// Cancel leaves everything as it was. Sign out anyway goes ahead with `force`: the changes are kept
// on this device, and `done(result)` runs once it has left.
export const signOutWaiting = ({ kind, count = 0, media = 0, done }) => confirmDrawer({
  title: count > 0 ? t('{0} not synced', changeCount(count)) : t('Changes not synced'),
  body: t('Some changes on this device have not reached your server.') + ' ' + keptNote(),
  items: media > 0 ? [tn('{0} photo or video has not reached your server yet.', '{0} photos or videos have not reached your server yet.', media)] : [],
  note: t('Wait until you’re back online and they sync by themselves.'),
  icon: 'signOut',
  confirmLabel: t('Sign out anyway'),
  onConfirm: () => leaveServer(kind, { done, force: true }),
})
