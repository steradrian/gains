import { canShareLink, inviteLink, shareLink } from '../../../lib/invite-link.js'
import { BRAND } from '../../../brand.js'
import { copyText } from '../../../lib/clipboard.js'
import { t } from '../../../lib/i18n.js'
import { back } from '../../../lib/use-tab-nav.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { createdMessage, inviteTitle } from './invite-data.js'
import { inviteMenuSheet, newInviteSheet } from './invite-drawers.jsx'
import InvitePage from './InvitePage.jsx'
import MemberInvite from './MemberInvite.jsx'
import { REAL_BACKEND, useInvite } from './use-invite.js'

// /me/invite: the admin's page (boards M5.0 to M5.3) or, for a member, the ask (invite-M3). Back
// goes down the Me tab's stack, or on a cold entry to the Me root (lib/tab-route.js parentOf).
// `backend` and `canShare` are for the screens gallery: an in-memory backend, and a build with or
// without a share sheet.
export default function InviteRoute({ backend = REAL_BACKEND, canShare = canShareLink() }) {
  const admin = useStore(s => !!s.user?.admin)
  return admin ? <AdminInvite backend={backend} canShare={canShare} /> : <MemberInvite />
}

const toast = (msg, opts) => useUI.getState().toast(msg, opts)

function AdminInvite({ backend, canShare }) {
  const invite = useInvite(backend)

  const revoke = async code => {
    try {
      await invite.revoke(code)
      toast(t('Invite revoked'))
    } catch (e) {
      toast(e.message)
    }
  }

  // Resolves to null when made, else the message the drawer shows. Revoking from the toast is
  // not an Undo: the invite is gone for good, and the toast says so.
  const create = async ({ name, requestId, share }) => {
    try {
      const { invite: made, how } = await invite.create({ name, requestId, share })
      toast(createdMessage(made.name, how), { action: t('Revoke'), onAction: () => revoke(made.code) })
      return null
    } catch (e) {
      return e.message
    }
  }

  const open = ({ ask = null, name = '' } = {}) => newInviteSheet({ ask, name, canShare, onCreate: create })

  const menu = i => inviteMenuSheet({
    title: inviteTitle(i),
    line: t('Waiting'),
    canShare,
    onCopy: async () => toast(await copyText(inviteLink(i.code)) ? t('Invite link copied') : t('Could not copy the invite link')),
    onShare: async () => {
      try { await shareLink(inviteLink(i.code), BRAND.name) } catch { toast(t('Could not share the invite link')) }
    },
    onRevoke: () => revoke(i.code),
  })

  return (
    <InvitePage status={invite.status} groups={invite.groups} requests={invite.requests} inviteOnly={invite.inviteOnly} fresh={invite.fresh}
      onBack={() => back()} onCreate={() => open()} onAnswer={ask => open({ ask })} onMenu={menu} onRenew={i => open({ name: i.name || '' })} onRetry={invite.reload} />
  )
}
