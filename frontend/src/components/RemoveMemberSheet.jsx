import { useRef } from 'react'
import { t } from '../lib/i18n.js'
import { friendsErrorText } from '../lib/friends/api.js'
import { removeEffect } from '../lib/friends/member-view.js'
import { refreshMember, removeFromGroup } from '../lib/friends/use-member.js'
import { closeThen, closeThenReplace } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import ConfirmDrawer from '../ds/ConfirmDrawer.jsx'
import { GROUPS_PATH } from '../views/friends/me-rows.js'

// Remove from group? (board Fr2Remove, R5): the creator's confirm. Remove sits on top, Cancel low,
// and there is no Undo: she can only come back with a new invite. Cancel, the x, the scrim, Escape
// and Back close just this panel, so Back returns to the Member menu it was opened from.
function RemoveMember({ group, member, close }) {
  const going = useRef(false)
  const effect = removeEffect(member, group)
  const items = [
    t('Their moments and past workouts stop showing in the group'),
    effect && t('The group goal drops their {0} planned sessions: {1} becomes {2}', effect.mine, effect.before, effect.after),
    t('They see they are no longer in the group; their own data stays as it is'),
  ].filter(Boolean)

  const confirm = async () => {
    if (going.current) return
    going.current = true
    try {
      const { name, groupName } = await removeFromGroup(group.id, member.uid)
      // The drawer's history entries are walked off first, then the Member page itself is replaced
      // by the group, which says what happened (route state, once). Back does not land on a page
      // that no longer exists.
      closeThenReplace(close, GROUPS_PATH + '/' + encodeURIComponent(group.id), { removed: name || member.name, group: groupName || group.name })
    } catch (e) {
      // Stay on the page. A 404 means they are already gone: the page's own refetch says so and leaves.
      closeThen(close, () => {
        if (e?.status === 404) { void refreshMember(group.id, member.uid); return }
        useUI.getState().toast(e?.status === 403 ? t('Only the person who created {0} can remove people.', group.name) : friendsErrorText())
      })
    }
  }

  return (
    <ConfirmDrawer
      title={t('Remove from group?')}
      body={t('{0} can only come back with a new invite.', member.name)}
      items={items}
      icon="signOut"
      haptic
      confirmLabel={t('Remove {0}', member.name)}
      onConfirm={confirm}
      cancelLabel={t('Cancel')}
      onCancel={close}
    />
  )
}

/**
 * Opens the Remove confirm for `member` of `group` ({ id, name, week: { planned } } and
 * { uid, name, week? }). From the Member menu it is a sub-panel on that drawer; on success the
 * drawer closes and the Member page is replaced by the group, with { removed, group } as route
 * state for the group's toast.
 */
export const removeMemberSheet = ({ group, member }) =>
  useUI.getState().openSheet(close => <RemoveMember group={group} member={member} close={close} />, { variant: 'ds' })
