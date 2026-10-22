import { useSyncExternalStore } from 'react'
import { friendsErrorText } from '../lib/friends/api.js'
import { sharedLine } from '../lib/friends/group-copy.js'
import { getFriends, subscribeFriends } from '../lib/friends/store.js'
import { muteGroupNotifications, useGroupSnapshot } from '../lib/friends/use-group.js'
import { t } from '../lib/i18n.js'
import { closeThenNav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import DetailRow from '../ds/DetailRow.jsx'
import Switch from '../ds/Switch.jsx'
import { GROUPS_PATH } from '../views/friends/me-rows.js'
import { inviteSheet } from './InviteSheet.jsx'
import { leaveGroupSheet } from './LeaveGroupSheet.jsx'

// The Group page's ⋯ (board Fr2GroupMenu): Invite to this group, What you share here, Mute
// notifications from this group, Leave. Invite and Leave open as sub-panels of this drawer (plain
// openSheet), so Back returns here; What you share here is a page, so the drawer's history entry
// goes first. Only the mute switch commits something by itself, so it alone ticks. The rows are the
// same for the creator and a member: the board draws nothing creator-only here (removing someone
// is on that member's own menu).
function GroupMenu({ group, close }) {
  const live = useGroupSnapshot(group.id).group || group
  const share = useSyncExternalStore(subscribeFriends, () => getFriends().me?.share, () => getFriends().me?.share)
  const muted = !!live.muteNotifications

  const setMuted = async next => {
    try {
      await muteGroupNotifications(group.id, next)
    } catch {
      useUI.getState().toast(friendsErrorText())
    }
  }

  return (
    <BottomSheet title={live.name}>
      <DetailRow icon="link" title={t('Invite to this group')} sub={t('A link, or someone already on Gains')} onClick={() => inviteSheet(group.id)} />
      <DetailRow icon="shield" title={t('What you share here')} sub={sharedLine(share)} onClick={() => closeThenNav(close, GROUPS_PATH + '/sharing')} />
      <DetailRow icon="bellSlash" title={t('Mute notifications from this group')} sub={t('Cheers and moments stay in the group')}
        trailing={<Switch ariaLabel={t('Mute notifications from this group')} checked={muted} onChange={setMuted} haptic />} />
      <DetailRow icon="signOut" title={t('Leave group')} sub={t('Asks first')} danger onClick={() => leaveGroupSheet(live)} />
    </BottomSheet>
  )
}

/** Opens the Group menu for `group` (`{ id, name, ... }`); it redraws from the live group while open. */
export const groupMenuSheet = group => useUI.getState().openSheet(close => <GroupMenu group={group} close={close} />, { variant: 'ds' })
