import { useLayoutEffect } from 'react'
import { __resetCardSeen } from '../../../lib/friends/card-seen.js'
import { __setMockCheers } from '../../../lib/friends/use-cheers.js'
import { __resetFirstSeen } from '../../../lib/friends/use-friends-feed.js'
import { useTodayCard } from '../../../lib/friends/use-today-card.js'
import { feedOf } from '../../../lib/notifications/feed.js'
import { friendsCardMenuSheet } from '../../../components/FriendsCardMenuSheet.jsx'
import { useUI } from '../../../store/useUI.js'
import CheersScreen from '../../../views/friends/CheersScreen.jsx'
import NotificationsScreen from '../../../views/shared/NotificationsScreen.jsx'
import TodayScreen from '../../../views/today/TodayScreen.jsx'
import { registerScreens } from '../registry.js'
import { FriendsMock } from './friends-core.jsx'
import { GROUP, GROUP_QUIET, ME_ON } from './friends-fixture.js'
import {
  CHEERS_PLAIN, CHEERS_TWO_GROUPS, CHEERS_WITH_WEEK, ME_NEW_CHEERED, ME_NEW_ONE, ME_NEW_TWO, ME_NOTHING_NEW, NOTIF_FRIENDS, NOTIF_NOW,
} from './friends-surfaces-fixture.js'
import { both } from './today-fixture.js'

// Friends surfaces m1 (boards T1FFriends, T1FFriendsMenu, Fr8Cheers, and the cheer and invite
// notifications): the real Today, Cheers for you and Notifications screens, reading the real
// Friends cache with the fixture laid over it. Nothing here touches the network or real storage:
// the cache, the cheers, the card's "seen" mark and the invites' first-seen times are in memory.
const NOOP = () => {}
const USER = { id: 'u-adrian', name: 'Adrian' }
// A cheer from the card is answered here, so the pill turns and Undo works without a server.
const mock = { user: USER, api: { 'POST /api/friends/cheers': { ok: true }, 'DELETE /api/friends/cheers': { ok: true } } }

// The cache with a fixture over it, a fresh "seen" mark, and (for Cheers) this week's cheers.
function SurfacesMock({ me, groups, cheers, stale = false, children }) {
  useLayoutEffect(() => {
    __resetCardSeen()
    __resetFirstSeen()
    const undo = cheers ? __setMockCheers(cheers, { stale }) : undefined
    return () => undo?.()
  }, [cheers, stale])
  return <FriendsMock me={me} groups={groups} stale={stale}>{children}</FriendsMock>
}

// Today with the card useTodayCard() works out from the cache; the rest is the board's day.
function TodayWithCard() {
  const friends = useTodayCard()
  return <TodayScreen {...both} friends={friends} />
}

const today = me => () => <SurfacesMock me={me} groups={ONE_GROUP}><TodayWithCard /></SurfacesMock>
const cheers = (list, groups) => () => <SurfacesMock me={ME_ON} groups={groups} cheers={list}><CheersScreen /></SurfacesMock>

const hold = () => useUI.getState().pauseToast()
const openMenu = () => friendsCardMenuSheet(GROUP, { uid: USER.id, at: Date.now() })

// The Notifications page from the feed the real code works out of the fixture's cheers and invites.
const EMPTY_PROFILE = { unit: 'kg', workouts: [], routines: [], week: {}, dayPlan: {}, queue: null, bodyweight: [], customEx: [] }
const feed = () => feedOf(EMPTY_PROFILE, { now: NOTIF_NOW, friends: NOTIF_FRIENDS })
const notifBase = {
  now: NOTIF_NOW, permission: 'on', homeScreen: false, hasReminders: false, friends: true,
  onOpen: NOOP, onMarkAllRead: NOOP, onTurnOn: NOOP, onReminders: NOOP, onBack: NOOP,
}

// Stable lists: the mock is laid over the cache again when they change.
const ONE_GROUP = [GROUP]
const TWO_GROUPS = [GROUP, GROUP_QUIET]

registerScreens('Friends: surfaces', [
  { id: 'friends-surfaces-today-one', title: 'T1.16 Today, Friends card (one moment)', note: 'Between the actions and Up next: a New tag, "Mara finished Legs", Iron Sunday and its week, a Cheer pill and the options button.',
    path: '/home', mock, render: today(ME_NEW_ONE) },
  { id: 'friends-surfaces-today-two', title: 'T1.16 Today, Friends card (two moments)', note: 'Two moments on one line, "Mara finished Legs · Radu set a new best", and two initials.',
    path: '/home', mock, render: today(ME_NEW_TWO) },
  { id: 'friends-surfaces-today-cheered', title: 'T1.16 Today, after Cheer', note: 'The pill turns into Cheered and the toast "Cheered Mara" with Undo is held open.',
    path: '/home', mock, render: today(ME_NEW_TWO),
    play: async tools => { await tools.click('Cheer'); await tools.wait(200); hold() } },
  { id: 'friends-surfaces-today-cheered-server', title: 'T1.16 Today, already cheered', note: 'Cheered on another visit: the server says so, so the pill is already turned.',
    path: '/home', mock, render: today(ME_NEW_CHEERED) },
  { id: 'friends-surfaces-today-none', title: 'T1.16 Today, nothing new', note: 'Friends on, a group, nothing new: no card at all, and Today is exactly the same height.',
    path: '/home', mock, render: today(ME_NOTHING_NEW) },
  { id: 'friends-surfaces-menu', title: 'T1.17 Friends card options', note: 'Hide this card, Open Iron Sunday (17 of 22 this week) and Turn off Friends (danger, asks first).',
    path: '/home', mock, render: today(ME_NEW_ONE), play: async tools => { openMenu(); await tools.wait(300) } },
  { id: 'friends-surfaces-menu-turn-off', title: 'T1.17 Turn off Friends, the confirm', note: 'Turn off Friends opens its confirm as a sub-panel of the menu; back returns to the menu.',
    path: '/home', mock, render: today(ME_NEW_ONE),
    play: async tools => { openMenu(); await tools.wait(300); await tools.click('Turn off Friends'); await tools.wait(300) } },
  { id: 'friends-surfaces-menu-hidden', title: 'T1.17 After Hide this card', note: 'The card is gone until something newer happens; Friends stays on.',
    path: '/home', mock, render: today(ME_NEW_ONE), play: async tools => { openMenu(); await tools.wait(300); await tools.click('Hide this card'); await tools.wait(300) } },
  { id: 'friends-surfaces-cheers', title: 'M6.16 Cheers for you', note: 'From Iron Sunday, This week 3: two moments, and a week every other member cheered, with its streak.',
    path: '/me/groups/cheers', mock, render: cheers(CHEERS_WITH_WEEK, ONE_GROUP) },
  { id: 'friends-surfaces-cheers-some', title: 'M6.16 Cheers for you, not everyone', note: 'Only some cheered the week: each is their own row and no streak line.',
    path: '/me/groups/cheers', mock, render: cheers(CHEERS_PLAIN, ONE_GROUP) },
  { id: 'friends-surfaces-cheers-two-groups', title: 'M6.16 Cheers for you, two groups', note: 'No "From" line; each row names its group.',
    path: '/me/groups/cheers', mock, render: cheers(CHEERS_TWO_GROUPS, TWO_GROUPS) },
  { id: 'friends-surfaces-cheers-empty', title: 'M6.16 No cheers yet', note: 'The bell scene and "No cheers yet this week".',
    path: '/me/groups/cheers', mock, render: cheers([], ONE_GROUP) },
  { id: 'friends-surfaces-notifications', title: 'N1 Notifications with Friends', note: 'One cheer item for the evening ("Ioana and 2 others cheered you"), an invitation and a challenge started in Iron Sunday.',
    mock, render: () => {
      const items = feed()
      return <NotificationsScreen {...notifBase} sections={{ new: items, thisWeek: [], earlier: [] }} unreadCount={items.length}
        isUnread={() => true} />
    } },
  { id: 'friends-surfaces-notifications-read', title: 'N1 Notifications with Friends, read', note: 'The same three, read: no dots.',
    mock, render: () => <NotificationsScreen {...notifBase} sections={{ new: [], thisWeek: feed(), earlier: [] }} unreadCount={0} isUnread={() => false} /> },
  { id: 'friends-surfaces-notifications-empty', title: 'N1 Nothing yet, Friends on', note: 'The bell scene; its line now names Friends.',
    mock, render: () => <NotificationsScreen {...notifBase} sections={{ new: [], thisWeek: [], earlier: [] }} unreadCount={0} isUnread={() => false} /> },
])
