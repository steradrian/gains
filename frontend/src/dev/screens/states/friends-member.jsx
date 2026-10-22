import { useLayoutEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { __setMockMember } from '../../../lib/friends/use-member.js'
import { useUI } from '../../../store/useUI.js'
import { memberMenuSheet } from '../../../components/MemberMenuSheet.jsx'
import { removeMemberSheet } from '../../../components/RemoveMemberSheet.jsx'
import GroupScreen from '../../../views/friends/GroupScreen.jsx'
import MemberScreen from '../../../views/friends/MemberScreen.jsx'
import { registerScreens } from '../registry.js'
import { ME_ON, mockFriends } from './friends-fixture.js'
import {
  GROUP_FULL, GROUP_NOT_CREATOR, GROUP_WITHOUT_MARA, GROUP_WITHOUT_MARA_SUMMARY, MEMBER_IOANA_NOTHING, MEMBER_MARA, MEMBER_MARA_CHEERED,
  MEMBER_RADU_SOME_OFF, MEMBER_SELF, MEMBER_VLAD_GAP, groupWithMuted,
} from './friends-member-fixture.js'

// Friends group m2 (boards Fr2Member, Fr2Gap, Fr2MemberMenu, Fr2Remove, Fr2Removed): the real
// Member page reading the real member cache with the fixture laid over it. Nothing here touches the
// network or real storage: the cache is in memory (__setMockMember), and a write in a mocked state
// only changes that copy.
const USER = { id: 'u-adrian', name: 'Adrian' }
const mock = { user: USER }
const PATH = uid => '/me/groups/' + GROUP_FULL.id + '/member/' + uid

// Lays the member and their group over the cache for as long as the state shows.
function MemberMock({ member, group, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undo = __setMockMember({ groupId: group.id, uid: member.uid, member, group })
    setReady(true)
    return () => { setReady(false); undo() }
  }, [member, group])
  return ready ? children : null
}

const page = (member, group = GROUP_FULL) => () => (
  <MemberMock member={member} group={group}>
    <Routes><Route path="/me/groups/:id/member/:uid" element={<MemberScreen />} /></Routes>
  </MemberMock>
)

const wait = async (tools, ms = 400) => { await tools.wait(ms) }
const menu = (member, group = GROUP_FULL) => async tools => {
  await wait(tools)
  memberMenuSheet({ group, member })
  await wait(tools, 300)
}
// The Remove confirm opened from the menu, as the Remove row does: a sub-panel with Back to the menu.
const remove = (member, group = GROUP_FULL) => async tools => {
  await menu(member, group)(tools)
  removeMemberSheet({ group, member })
  await wait(tools, 300)
}

// The Group with Mara gone, as it opens after Remove: the route state carries who and from where.
// The toast is also fired here, so the state shows it whether or not the Group page reads the route
// state itself (a toast replaces the one before it).
function RemovedRoute() {
  const nav = useNavigate()
  const loc = useLocation()
  const [go, setGo] = useState(false)
  useLayoutEffect(() => { nav(loc.pathname, { replace: true, state: { removed: 'Mara', group: 'Iron Sunday' } }) }, [])
  useLayoutEffect(() => { if (loc.state?.removed) setGo(true) }, [loc.state])
  return go ? <GroupScreen /> : null
}

function RemovedMock() {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undo = mockFriends({ me: { ...ME_ON, groups: [GROUP_WITHOUT_MARA_SUMMARY] }, groups: [GROUP_WITHOUT_MARA_SUMMARY] })
    setReady(true)
    return () => { setReady(false); undo() }
  }, [])
  return ready ? <RemovedRoute /> : null
}

registerScreens('Friends: group member', [
  { id: 'friends-group-member', title: 'M6.6 Member', note: 'Mara: this week 3 of 4, recent workouts, eight weeks (one week off, empty), food targets, a new best, and what she does not share.',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA) },
  { id: 'friends-group-member-cheered', title: 'M6.6 Member, week cheered', note: 'The pill says Cheered once the week is cheered; the toast Undo turns it back.',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA_CHEERED) },
  { id: 'friends-group-member-some-off', title: 'M6.6 Member, some shares off', note: 'Radu shares only training: no consistency, targets or bests, and the footer names what he keeps off.',
    path: PATH('u-radu'), mock, render: page(MEMBER_RADU_SOME_OFF) },
  { id: 'friends-group-member-self', title: 'M6.6 Your own page', note: 'No Cheer pill and no menu: a back button only.',
    path: PATH('u-adrian'), mock, render: page(MEMBER_SELF) },
  { id: 'friends-group-gap', title: 'M6.7 Member, no plan this week', note: 'Vlad took the week off: a calm line, never red, and no count against the goal. Consistency and food targets stay.',
    path: PATH('u-vlad'), mock, render: page(MEMBER_VLAD_GAP) },
  { id: 'friends-group-nothing-shared', title: 'M6.7 Member shares nothing', note: 'Every switch off: one line saying so, and the footer.',
    path: PATH('u-ioana'), mock, render: page(MEMBER_IOANA_NOTHING) },
  { id: 'friends-group-menu', title: 'M6.8 Member options, creator', note: 'Mute, Cheer their week and Remove from group (you created the group), then the no-report-flow line.',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA), play: menu(MEMBER_MARA) },
  { id: 'friends-group-menu-member', title: 'M6.8 Member options, not the creator', note: 'Mute and Cheer only: Remove is the creator\'s.',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA, GROUP_NOT_CREATOR), play: menu(MEMBER_MARA, GROUP_NOT_CREATOR) },
  { id: 'friends-group-menu-muted', title: 'M6.8 Member options, muted', note: 'Mara is muted: the first row reads Unmute and says what it brings back.',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA, groupWithMuted(GROUP_FULL, 'u-mara')), play: menu(MEMBER_MARA, groupWithMuted(GROUP_FULL, 'u-mara')) },
  { id: 'friends-group-remove', title: 'M6.23 Remove from group?', note: 'The confirm as a sub-panel of the menu: Remove Mara on top, Cancel low, three consequences (22 becomes 18).',
    path: PATH('u-mara'), mock, render: page(MEMBER_MARA), play: remove(MEMBER_MARA) },
  { id: 'friends-group-removed', title: 'M6.24 Group without her', note: 'Iron Sunday with four friends and 14 of 18 planned sessions; the toast "Removed Mara from Iron Sunday" is held open.',
    path: '/me/groups/' + GROUP_WITHOUT_MARA.id, mock, render: () => <RemovedMock />,
    play: async tools => {
      await tools.wait(300)
      useUI.getState().toast(t('Removed {0} from {1}', 'Mara', 'Iron Sunday'), { action: t('OK'), onAction: () => {} })
      useUI.getState().pauseToast()
    } },
])
