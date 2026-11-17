import { useRef } from 'react'
import { friendsErrorText } from '../lib/friends/api.js'
import { leaveBy } from '../lib/friends/group-copy.js'
import { leaveThisGroup } from '../lib/friends/use-group.js'
import { t } from '../lib/i18n.js'
import { closeThenReplace } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import ConfirmDrawer from '../ds/ConfirmDrawer.jsx'
import { GROUPS_PATH } from '../views/friends/me-rows.js'

// Leave group? (board Fr2Leave, R5): what leaving does, then Leave group on top and Cancel low.
// There is no Undo: the way back is a new invite. The request runs while the drawer is still up,
// so a refusal is toasted here and the person can try again; on success the drawer's history
// entries are walked off and Groups replaces the group's page (a Back from Groups must not land on
// a group the person is no longer in). Groups reads `{ left, by }` from the route state and says so.
function LeaveGroup({ group, close }) {
  const busy = useRef(false)
  const leave = async () => {
    if (busy.current) return
    busy.current = true
    try {
      await leaveThisGroup(group.id)
    } catch {
      busy.current = false
      useUI.getState().toast(friendsErrorText())
      return
    }
    closeThenReplace(close, GROUPS_PATH, { left: group.name, by: leaveBy(group) })
  }
  return (
    <ConfirmDrawer
      title={t('Leave group')}
      body={t('You can only come back with a new invite.')}
      items={[
        t('Your past workouts stop showing in the group'),
        t('The group goal drops your planned sessions from this week'),
        t('Your own data stays exactly as it is'),
      ]}
      icon="signOut"
      confirmLabel={t('Leave group')}
      onConfirm={leave}
      cancelLabel={t('Cancel')}
      onCancel={close}
      haptic
    />
  )
}

/** Opens the confirm for `group` (`{ id, name, creator, members }`). From inside the Group menu it is a sub-panel and Cancel goes back to the menu. */
export const leaveGroupSheet = group => useUI.getState().openSheet(close => <LeaveGroup group={group} close={close} />, { variant: 'ds' })
