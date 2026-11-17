import { Route, Routes } from 'react-router-dom'
import { inviteSheet } from '../../../components/InviteSheet.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import GroupsScreen from '../../../views/friends/GroupsScreen.jsx'
import JoinScreen from '../../../views/friends/JoinScreen.jsx'
import SharingScreen from '../../../views/friends/SharingScreen.jsx'
import Login from '../../../views/Login.jsx'
import { registerScreens } from '../registry.js'
import { FriendsMock } from './friends-core.jsx'
import { GROUP, ME_OFF, ME_ON, ME_ON_NO_GROUP, PREVIEW_STATE, SHARE } from './friends-fixture.js'

// Friends core m2 (boards Fr1Create, Fr5Sharing, Fr4Add, Fr4Join): the real screens and drawers over
// the in-memory Friends cache. Calls the screens make go to the gallery's fake API (mock.api), so
// nothing reaches a network or storage.
const USER = { id: 'u-adrian', name: 'Adrian' }
const CODE = 'k7Qp9x2Lm'
const NO_GROUPS = []
const ONE_GROUP = [GROUP]
const ME_ALL_OFF = { ...ME_ON, share: { training: false, consistency: false, targets: false, bests: false } }
const ME_ALL_ON = { ...ME_ON, share: { ...SHARE, bests: true } }

const base = { user: USER, S: PREVIEW_STATE }
const PEOPLE = [
  { uid: 'u-andrei', name: 'Andrei', since: '2026-10' },
  { uid: 'u-elena', name: 'Elena', since: '2026-09' },
]
const inviteApi = people => ({
  'POST /api/friends/groups/g-iron-sunday/invites': { code: 'Hn4Tz8Wq2X', url: 'unused', expiresAt: '2026-10-29T12:00:00Z' },
  'GET /api/friends/people': people,
  'POST /api/friends/groups/g-iron-sunday/invites/user': { ok: true },
})
const joinApi = body => ({ ['GET /api/friends/join/' + CODE]: body })
const PREVIEW_VALID = {
  status: 'valid',
  group: { id: 'g-iron-sunday', name: 'Iron Sunday', memberCount: 5, initials: ['A', 'M', 'R', 'I', 'V'] },
  from: { name: 'Mara' },
}

// The join page on its real route, so :code is the page's own.
const joinRoute = (me, groups = NO_GROUPS) => () => (
  <FriendsMock me={me} groups={groups}>
    <Routes>
      <Route path="/me/groups/join/:code" element={<JoinScreen />} />
      <Route path="/me/groups/:id" element={<Landed />} />
    </Routes>
  </FriendsMock>
)

// Where "already a member" lands: the group page (group-m1's), stood in for here.
function Landed() {
  return <StagePage parent="/me/groups"><StageEmpty illustration="dumbbell" card={false} title="Iron Sunday" body="The link opened the group you are already in." /></StagePage>
}

// The clipboard is stubbed for the length of one tap, so the gallery copies nothing for real.
async function tapCopy(tools) {
  const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } })
  try {
    await tools.click('Copy invite link')
    await tools.wait(300)
  } finally {
    if (own) Object.defineProperty(navigator, 'clipboard', own)
    else delete navigator.clipboard
  }
}

const groupsPlay = ask => async tools => { await tools.click(ask); await tools.wait(300) }
const openInvite = async tools => { inviteSheet(GROUP.id, GROUP.name); await tools.wait(400) }

registerScreens('Friends: core', [
  { id: 'friends-core-create-empty', title: 'M6.18 New group, empty', note: 'The drawer over Groups: name, the three goals, Create and invite.',
    path: '/me/groups', mock: base, render: () => <FriendsMock me={ME_ON_NO_GROUP} groups={NO_GROUPS}><GroupsScreen /></FriendsMock>,
    play: groupsPlay('Create a group') },
  { id: 'friends-core-create-filled', title: 'M6.18 New group, filled', note: 'A name typed and "A number we pick" chosen: the stepper appears and the planned-sessions line goes.',
    path: '/me/groups', mock: base, render: () => <FriendsMock me={ME_ON_NO_GROUP} groups={NO_GROUPS}><GroupsScreen /></FriendsMock>,
    play: async tools => {
      await tools.click('Create a group'); await tools.wait(300)
      await tools.type('Group name', 'Sunday crew')
      await tools.click('A number we pick')
    } },

  { id: 'friends-core-sharing-on', title: 'M6.17b What you share, all on', note: 'Four switches on, the two never-shared rows, and the preview as Mara sees you.',
    path: '/me/groups/sharing', mock: base, render: () => <FriendsMock me={ME_ALL_ON} groups={ONE_GROUP}><SharingScreen /></FriendsMock> },
  { id: 'friends-core-sharing-off', title: 'M6.17b What you share, all off', note: 'Every switch off: the preview shows only New bests, and nothing is claimed.',
    path: '/me/groups/sharing', mock: base, render: () => <FriendsMock me={ME_ALL_OFF} groups={ONE_GROUP}><SharingScreen /></FriendsMock> },
  { id: 'friends-core-sharing-first', title: 'M6.17b What you share, first time', note: 'From Turn on Friends: the button is the only way to turn it on; nothing goes out until you join.',
    path: '/me/groups/sharing', mock: base, render: () => <FriendsMock me={ME_OFF} groups={NO_GROUPS}><SharingScreen /></FriendsMock> },

  { id: 'friends-core-invite', title: 'M6.10 Invite to the group, people', note: 'Copy invite link, and the people already on Gains with an Invite each.',
    path: '/me/groups', mock: { ...base, api: inviteApi(PEOPLE) }, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock>, play: openInvite },
  { id: 'friends-core-invite-copied', title: 'M6.10 Invite, link copied', note: 'After Copy invite link the button says Link copied (the clipboard is stubbed here).',
    path: '/me/groups', mock: { ...base, api: inviteApi(PEOPLE) }, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock>,
    play: async tools => { await openInvite(tools); await tapCopy(tools) } },
  { id: 'friends-core-invite-invited', title: 'M6.10 Invite, one invited', note: 'Invite turns into Invited for that person.',
    path: '/me/groups', mock: { ...base, api: inviteApi(PEOPLE) }, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock>,
    play: async tools => { await openInvite(tools); await tools.click('Invite'); await tools.wait(300) } },
  { id: 'friends-core-invite-none', title: 'M6.10 Invite, nobody to invite', note: 'The search scene on the white drawer where the people would be.',
    path: '/me/groups', mock: { ...base, api: inviteApi([]) }, render: () => <FriendsMock me={ME_ON} groups={ONE_GROUP}><GroupsScreen /></FriendsMock>, play: openInvite },

  { id: 'friends-core-join', title: 'M6.2 Join by link, valid', note: 'Mara invited you to Iron Sunday; exactly what they will see, with Change; Join Iron Sunday / Not now.',
    path: '/me/groups/join/' + CODE, mock: { ...base, api: joinApi(PREVIEW_VALID) }, render: joinRoute(ME_ON, ONE_GROUP) },
  { id: 'friends-core-join-off', title: 'M6.2 Join by link, Friends off', note: 'Join is Turn on Friends (through What you share, then back here).',
    path: '/me/groups/join/' + CODE, mock: { ...base, api: joinApi(PREVIEW_VALID) }, render: joinRoute(ME_OFF) },
  { id: 'friends-core-join-expired', title: 'M6.2 Join by link, expired', note: 'This invite has expired, and who to ask.',
    path: '/me/groups/join/' + CODE, mock: { ...base, api: joinApi({ status: 'expired', from: { name: 'Mara' } }) }, render: joinRoute(ME_ON, ONE_GROUP) },
  { id: 'friends-core-join-unknown', title: 'M6.2 Join by link, unknown', note: 'Same page with no inviter, for a code the server does not know.',
    path: '/me/groups/join/' + CODE, mock: { ...base, api: joinApi({ status: 404, body: { error: 'Not found', code: 'not-found' } }) }, render: joinRoute(ME_ON, ONE_GROUP) },
  { id: 'friends-core-join-member', title: 'M6.2 Join by link, already a member', note: 'The link opens the group you are already in (the redirect target is stood in for here).',
    path: '/me/groups/join/' + CODE, mock: { ...base, api: joinApi({ status: 'member', group: PREVIEW_VALID.group }) }, render: joinRoute(ME_ON, ONE_GROUP) },

  { id: 'friends-core-join-signed-out', title: 'M6.2 Group link, not signed in', note: 'The sign-in screen with a group link waiting: Gains is invite-only, and the link still works once in.',
    mock: { config: { invite_only: true, password_login: true } }, render: () => <Login pendingGroup /> },
])
