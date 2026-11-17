import { useLayoutEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { __setMockGroup } from '../../../lib/friends/use-group.js'
import { useUI } from '../../../store/useUI.js'
import { groupMenuSheet } from '../../../components/GroupMenuSheet.jsx'
import { leaveGroupSheet } from '../../../components/LeaveGroupSheet.jsx'
import GroupScreen from '../../../views/friends/GroupScreen.jsx'
import { registerScreens } from '../registry.js'
import { GROUP, ME_ON, mockFriends } from './friends-fixture.js'
import {
  GROUP_ALONE, GROUP_AS_MEMBER, GROUP_FULL, GROUP_GAP_WEEK, GROUP_MUTED, GROUP_NO_ACTIVITY, GROUP_OVER_GOAL,
} from './friends-group-fixture.js'

// Friends group m1 (boards Fr2Group, Fr2Cheered, Fr2NoActivity, Fr2Muted, Fr2GroupMenu, Fr2Leave):
// the real Group page reading the real group cache with the fixture laid over it. Nothing here
// touches the network or real storage: the group and the groups cache are in memory, and every
// write a tap makes (a cheer, a mute) stays in that copy.
const USER = { id: 'u-adrian', name: 'Adrian' }
const mock = { user: USER }
const ONE_GROUP = [GROUP]

// Lays `group` over the cache for as long as the state shows, then puts the real one back.
function GroupMock({ group, status, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undoFriends = mockFriends({ me: ME_ON, groups: ONE_GROUP })
    const undoGroup = __setMockGroup(group?.id || GROUP.id, group, { status })
    setReady(true)
    return () => { setReady(false); undoGroup(); undoFriends() }
  }, [group, status])
  return ready ? children : null
}

const page = (group, status) => () => (
  <GroupMock group={group} status={status}>
    <Routes><Route path="/me/groups/:id" element={<GroupScreen />} /></Routes>
  </GroupMock>
)

const PATH = '/me/groups/' + GROUP.id
const ALONE_PATH = '/me/groups/' + GROUP_ALONE.id
const holdToast = async tools => { await tools.wait(300); useUI.getState().pauseToast() }

registerScreens('Friends: group', [
  { id: 'friends-group', title: 'M6.4 Group', note: 'Iron Sunday: the ring with a segment per member, 5 of 7 targets and the 4-week streak, the legend, this week together, a challenge, and four moments with Cheer.',
    path: PATH, mock, render: page(GROUP_FULL) },
  { id: 'friends-group-cheered', title: 'M6.22 After a cheer', note: 'Mara finished Legs turns to Cheered, white and still; the toast "Cheered Mara\'s Legs" with Undo is held open.',
    path: PATH, mock, render: page(GROUP_FULL),
    play: async tools => { await tools.click('Cheer'); await holdToast(tools) } },
  { id: 'friends-group-no-activity', title: 'M6.5 New week, no activity yet', note: 'Monday morning: New week, 0 / 22, Goal hit 4 weeks in a row, Quiet so far in place of moments, and a challenge not joined yet.',
    path: PATH, mock, render: page(GROUP_NO_ACTIVITY) },
  { id: 'friends-group-muted', title: 'M6.21 A member muted', note: 'The banner "You muted Vlad" with Unmute; his moment is already gone from the list; the mute toast with Undo is held open.',
    path: PATH, mock, render: page(GROUP_MUTED),
    play: async tools => {
      useUI.getState().toast(t('Muted {0}. They are not told.', 'Vlad'), { action: t('Undo'), onAction: () => {} })
      await holdToast(tools)
    } },
  { id: 'friends-group-menu', title: 'M6.3 Group menu (creator)', note: 'Invite to this group, What you share here, the Mute notifications switch and Leave group, over the group.',
    path: PATH, mock, render: page(GROUP_FULL),
    play: async tools => { groupMenuSheet(GROUP_FULL); await tools.wait(400) } },
  { id: 'friends-group-menu-member', title: 'M6.3 Group menu (member)', note: 'The same four rows for someone who did not create the group: the board draws nothing creator-only here.',
    path: PATH, mock, render: page(GROUP_AS_MEMBER),
    play: async tools => { groupMenuSheet(GROUP_AS_MEMBER); await tools.wait(400) } },
  { id: 'friends-group-leave', title: 'M6.11c Leave group? confirm', note: 'The confirm slid in over the menu: three consequences, Leave group on top, Cancel below.',
    path: PATH, mock, render: page(GROUP_AS_MEMBER),
    play: async tools => { groupMenuSheet(GROUP_AS_MEMBER); await tools.wait(300); leaveGroupSheet(GROUP_AS_MEMBER); await tools.wait(400) } },
  { id: 'friends-group-alone', title: 'M6.4 Only you in the group', note: 'The ring is just yours; Invite sits where moments would be.',
    path: ALONE_PATH, mock, render: page(GROUP_ALONE) },
  { id: 'friends-group-gap', title: 'M6.4 A member with no plan this week', note: 'Radu has no segment and reads No plan in the legend; nothing is red.',
    path: PATH, mock, render: page(GROUP_GAP_WEEK) },
  { id: 'friends-group-over-goal', title: 'M6.4 Over the goal', note: '19 / 17: the ring is full, calm, and nothing says "over".',
    path: PATH, mock, render: page(GROUP_OVER_GOAL) },
  { id: 'friends-group-error', title: 'M6.4 Group could not load', note: 'No data and no answer: the page says so instead of staying blank.',
    path: PATH, mock, render: page(null, 'error') },
])
