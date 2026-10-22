import { t } from '../lib/i18n.js'
import { cheerWeek, setMuted, useMemberState } from '../lib/friends/use-member.js'
import { haptic } from '../lib/use-haptic.js'
import { useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import MenuList from '../ds/MenuList.jsx'
import { removeMemberSheet } from './RemoveMemberSheet.jsx'

// Member options (board Fr2MemberMenu): Mute, Cheer their week, and Remove from group for the
// creator. Mute and Cheer commit on the tap (a haptic tick, a toast with Undo) and close the
// drawer; Remove asks first, in a sub-panel of this drawer so Back returns here. There is no
// report flow: everyone in a group was invited by someone in it.
function MemberMenu({ group, member, close }) {
  const { muted, isCreator, you, member: live, group: liveGroup } = useMemberState(group.id, member.uid)
  const name = member.name
  const cheered = live?.cheered === true

  const items = [
    {
      key: 'mute',
      icon: muted ? 'bell' : 'bellSlash',
      label: muted ? t('Unmute {0}', name) : t('Mute {0}', name),
      detail: muted ? t("Brings {0}'s moments back.", name) : t("Hides {0}'s moments for you. {0} still counts toward the goal and isn't told.", name),
      onClick: () => { haptic('light'); close(); void setMuted(group.id, member.uid, !muted) },
    },
    {
      key: 'cheer',
      icon: 'heart',
      label: t("Cheer {0}'s week", name),
      detail: cheered ? t('Cheered this week') : t('One cheer for the whole week'),
      disabled: cheered,
      onClick: () => { haptic('light'); close(); void cheerWeek(group.id, member.uid) },
    },
    // Only the creator, and never on yourself: the server refuses both anyway.
    ...(isCreator && !you ? [{
      key: 'remove',
      icon: 'signOut',
      tone: 'danger',
      label: t('Remove from group'),
      detail: t('Only you see this: you created {0}. Asks first.', group.name),
      onClick: () => removeMemberSheet({ group: liveGroup || group, member: live || member }),
    }] : []),
  ]

  return (
    <BottomSheet title={name}>
      <MenuList items={items} label={t('Member options')} />
      <p className="g-bs-note">{t('No report flow: everyone in a group was invited by someone in it. Mute hides {0} for you; the creator can remove them.', name)}</p>
    </BottomSheet>
  )
}

/**
 * Opens the Member menu for `member` ({ uid, name }) of `group` ({ id, name }). Whether they are
 * muted, whether you created the group and whether it is you are read live from the Member page's
 * data, so the rows follow a Mute that just landed.
 */
export const memberMenuSheet = ({ group, member }) =>
  useUI.getState().openSheet(close => <MemberMenu group={group} member={member} close={close} />, { variant: 'ds' })
