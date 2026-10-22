import { useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { __setMockStale } from '../../../lib/friends/store.js'
import { useUI } from '../../../store/useUI.js'
import GroupsScreen from '../../../views/friends/GroupsScreen.jsx'
import { groupsRow, groupsRowValue } from '../../../views/friends/me-rows.js'
import SettingsRootScreen from '../../../views/settings/SettingsRootScreen.jsx'
import { registerScreens } from '../registry.js'
import { GROUP, GROUP_QUIET, ME_OFF, ME_ON, ME_ON_NO_GROUP, PREVIEW_STATE, mockFriends } from './friends-fixture.js'

// Friends core m1 (boards Fr6Off, Fr1Groups, Fr1Empty, Fr1Left): the real Groups screen, reading
// the real Friends cache with the fixture laid over it. Nothing here touches the network or real
// storage: the cache is in memory (mockFriends) and the person's own state is `mock.S`.
const NOOP = () => {}
const USER = { id: 'u-adrian', name: 'Adrian' }
const mock = { user: USER, S: PREVIEW_STATE }

// Lays the fixture over the Friends cache for as long as the state shows, then puts the real one back.
export function FriendsMock({ me, groups, stale = false, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undo = mockFriends({ me, groups })
    if (stale) __setMockStale()
    setReady(true)
    return () => { setReady(false); undo() }
  }, [me, groups, stale])
  return ready ? children : null
}

// Groups as it opens right after Leave group: the route state carries who and from where.
function LeftRoute() {
  const nav = useNavigate()
  const loc = useLocation()
  const [go, setGo] = useState(false)
  useLayoutEffect(() => { nav(loc.pathname, { replace: true, state: { left: 'Iron Sunday', by: 'Mara' } }) }, [])
  useLayoutEffect(() => { if (loc.state?.left) setGo(true) }, [loc.state])
  return go ? <GroupsScreen /> : null
}

// The Me root's "Keep you on track" group with the real Groups row (its definition and its value).
function MeRoot() {
  const value = groupsRowValue()
  const groups = [{
    key: 'track', title: 'Keep you on track', rows: [
      { key: 'reminders', icon: 'bell', title: 'Reminders', sub: 'The notifications you set yourself', value: '4 on', onClick: NOOP },
      { key: 'features', icon: 'slider', title: 'Features', sub: 'What Gains tracks for you', value: 'Fasting off', onClick: NOOP },
      { key: groupsRow.id, icon: groupsRow.icon, title: t(groupsRow.title), sub: value.sub, value: value.value, onClick: NOOP },
    ],
  }]
  return <SettingsRootScreen
    account={{ initial: 'A', name: 'Adrian', line: 'Admin · 2 passkeys · this iPhone', onOpen: NOOP }}
    pill={null} onPill={NOOP} groups={groups}
    search={{ open: false, query: '', rows: [], onOpen: NOOP, onQuery: NOOP, onClose: NOOP }}
    signOut={{ title: 'Sign out', sub: 'This iPhone only', onClick: NOOP }}
    footer="Gains 0.1.0 · settings sync to every device you sign in on." />
}

// Stable lists: the mock is laid over the cache again when they change.
const NO_GROUPS = []
const ONE_GROUP = [GROUP]
const TWO_GROUPS = [GROUP, GROUP_QUIET]

registerScreens('Friends: core', [
  { id: 'friends-core-off', title: 'M6.20 Friends off', note: 'The bell scene, Turn on Friends (goes to What you share first), and what Friends adds.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_OFF} groups={NO_GROUPS}><GroupsScreen /></FriendsMock> },
  { id: 'friends-core-groups', title: 'M6.0 Groups', note: 'Iron Sunday with its five initials, Join with an invite link, Create a group, and what you share with the preview.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock> },
  { id: 'friends-core-groups-two', title: 'M6.0 Groups, two groups', note: 'A card each; a quiet one with no week and no streak says only its name.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON} groups={TWO_GROUPS}><GroupsScreen /></FriendsMock> },
  { id: 'friends-core-groups-stale', title: 'M6.0 Groups, server out of reach', note: 'The last update stays, with a banner that says so.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP} stale><GroupsScreen /></FriendsMock> },
  { id: 'friends-core-empty', title: 'M6.1 On, no group yet', note: 'Better together, Create a group and Join with an invite link, then what friends would see.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON_NO_GROUP} groups={NO_GROUPS}><GroupsScreen /></FriendsMock> },
  { id: 'friends-core-left', title: 'M6.11 After leaving', note: 'No group right now, the same two rows and What you share; the toast "You left Iron Sunday" is held open.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON_NO_GROUP} groups={NO_GROUPS}><LeftRoute /></FriendsMock>,
    play: async tools => { await tools.wait(300); useUI.getState().pauseToast() } },
  { id: 'friends-core-join-sheet', title: 'M6.0 Join with an invite link', note: 'The half drawer with the paste field, over Groups.',
    path: '/me/groups', mock, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock>,
    play: async tools => { await tools.click('Join with an invite link'); await tools.wait(300) } },
  { id: 'friends-core-me-row', title: 'Groups row on Me', note: 'The Me root with the Groups row: the group and its week, and the New mark until Groups was opened.',
    mock, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><MeRoot /></FriendsMock> },
])
