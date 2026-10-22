import { t } from '../lib/i18n.js'
import { markCardSeen } from '../lib/friends/card-seen.js'
import { closeThenNav } from '../lib/nav.js'
import { useUI } from '../store/useUI.js'
import { confirmTurnOff, GROUPS_PATH } from '../views/friends/me-rows.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import MenuList from '../ds/MenuList.jsx'

// T1.17, the Today Friends card's options. Hide this card is not Turn off Friends: Hide only
// stores that this moment was seen (the card is back for the next new thing), Turn off stops all
// sharing and asks first, with the same confirm the Features switch opens (me-rows.js), as a
// sub-panel of this drawer. `uid` and `at` are who is looking and when the newest moment was.

function FriendsCardMenu({ group, uid, at, close }) {
  const seen = () => markCardSeen(uid, Math.max(Date.now(), at))
  const items = [
    { key: 'hide', icon: 'xmark', label: t('Hide this card'), detail: t('Until something new happens'),
      onClick: () => { seen(); close() } },
    { key: 'open', icon: 'users', label: t('Open {0}', group.name),
      detail: group.week?.planned > 0 ? t('{0} of {1} this week', group.week.done, group.week.planned) : undefined,
      onClick: () => { seen(); closeThenNav(close, GROUPS_PATH + '/' + encodeURIComponent(group.id)) } },
    { key: 'off', icon: 'bellSlash', tone: 'danger', label: t('Turn off Friends'), detail: t('Stops sharing everywhere. Asks first'),
      onClick: () => confirmTurnOff({ onDone: close }) },
  ]
  return (
    <BottomSheet title={t('Friends')}>
      <MenuList items={items} label={t('Friends card options')} />
    </BottomSheet>
  )
}

/** Opens the Friends card's menu for `group` (a GroupSummary); `{ uid, at }` as above. */
export const friendsCardMenuSheet = (group, { uid, at }) =>
  useUI.getState().openSheet(close => <FriendsCardMenu group={group} uid={uid} at={at} close={close} />, { variant: 'ds' })
