import { t } from '../../lib/i18n.js'
import { friendsAvailable, friendsErrorText } from '../../lib/friends/api.js'
import { getFriends, isMockFriends } from '../../lib/friends/store.js'
import { turnOff } from '../../lib/friends/use-friends.js'
import { useUI } from '../../store/useUI.js'
import { confirmDrawer } from '../settings/confirm-drawer.js'

// The two rows Friends puts into other boards' lists, defined here so each host file carries a
// one-line import: the Groups row of the Me root (views/me/root-rows.js ME_ROW_SLOTS.you) and the
// Friends switch of Settings > Features (features-rows.js friendsRow).

export const GROUPS_PATH = '/me/groups'
export const SHARING_FIRST_PATH = '/me/groups/sharing?first=1'

const SEEN_KEY = 'gains_friends_groups_seen'

/**
 * Whether this person has opened Groups once (the "New" mark on its row goes then). Per viewer, in
 * localStorage. The gallery's mock never reads or writes it, so a state always shows the mark.
 */
export function groupsSeen() {
  if (isMockFriends()) return false
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export function markGroupsSeen() {
  if (isMockFriends()) return
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode: the mark stays */ }
}

/**
 * A Me root row (root-rows.js ME_ROW_SLOTS.you): only where Friends exists. `line()` is what it
 * says, from the Friends cache: the title, the sub and the `New` tag.
 */
export const groupsRow = {
  id: 'groups',
  icon: 'users',
  to: GROUPS_PATH,
  visible: () => friendsAvailable(),
  line: () => {
    const { value, sub } = groupsRowValue()
    return { title: t('Groups'), sub, tag: value }
  },
}

/**
 * What the Groups row says: the first group's name and "N of M this week" when in one, else
 * "Better together"; `New` as its value until Groups was opened once. The "of M" is left out when
 * the week has no plan to be of.
 */
export function groupsRowValue() {
  const { me, groups } = getFriends()
  const first = me?.on && Array.isArray(groups) ? groups[0] : null
  const sub = first
    ? [first.name, first.week?.planned > 0 ? t('{0} of {1} this week', first.week.done, first.week.planned) : null].filter(Boolean).join(' · ')
    : t('Better together')
  return { value: groupsSeen() ? null : t('New'), sub }
}

/**
 * Asks first (R5), then turns Friends off: nothing is shared, memberships are kept. `onDone` runs
 * once it is off (the Today card's menu closes itself then), not when it failed.
 */
export function confirmTurnOff({ onDone } = {}) {
  confirmDrawer({
    title: t('Stop sharing everywhere?'),
    body: t('Nothing is shared and nobody sees you in a group.'),
    note: t('Your groups are kept. Turn Friends back on to return to them.'),
    confirmLabel: t('Turn off Friends'),
    cancelLabel: t('Cancel'),
    onConfirm: async () => {
      try { await turnOff() } catch { useUI.getState().toast(friendsErrorText()); return }
      onDone?.()
    },
  })
}

/**
 * The Friends row of Settings > Features (features-rows.js; the props of SwitchRow). Turning it
 * on sends nothing: it opens What you share first, and Friends is on only once that editor's
 * button confirms. Turning it off asks first. `nav` is the page's navigate; no row where Friends
 * is not available.
 */
export function friendsFeatureRow({ nav }) {
  if (!friendsAvailable()) return []
  const { me } = getFriends()
  return [{
    key: 'friends',
    icon: 'users',
    title: t('Friends'),
    sub: t('Groups under Me. Nothing is shared until you join one'),
    checked: !!me?.on,
    disabled: !me,
    onChange: on => (on ? nav(SHARING_FIRST_PATH) : confirmTurnOff()),
  }]
}
