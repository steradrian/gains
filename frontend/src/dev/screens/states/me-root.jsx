import MeScreen from '../../../views/me/MeScreen.jsx'
import { ME_ROW_SLOTS } from '../../../views/me/root-rows.js'
import { registerScreens } from '../registry.js'
import { GOAL_NEW, GOAL_READY, GROUPS_ROW, S_NEW, S_NO_TARGET, S_REACHED, meProps } from './me-fixture.js'

// Me, Profile (PR-05 boards Me1Me M1.0, Me1New M1.1, Me1Friends M1.2 and the M1.0 rows of
// PR05Edges): the real MeScreen, given what useMe() would hand it on the boards' day, Sunday
// 18 October 2026, in memory only.
const me = (props = {}) => () => <MeScreen {...meProps(props)} />

registerScreens('Me', [
  { id: 'M1.0', title: 'Me, about you', note: 'Weight to target, 4 of 6 days on target, a 6-week streak; four actions; My goal; You; the muscles week.', render: me() },
  { id: 'M1.1', title: 'Nothing logged yet', note: 'A new account: the Weight ring is empty and asks for a first weigh-in, My goal asks for a target, no muscles card.',
    render: me({ S: S_NEW, days: null, goal: GOAL_NEW, invites: null, changeCount: 0, muscles: null, bodyLogged: false }) },
  { id: 'M1.2', title: 'Friends turned on', note: 'A mocked Groups row, tagged New, last in the You group.',
    render: me({ slots: { ...ME_ROW_SLOTS, you: [GROUPS_ROW] } }) },
  { id: 'M1.0t', title: 'Target reached', note: 'The Weight ring closes and reads Target reached; My goal offers Keep my weight, and nothing changes on its own.',
    render: me({ S: S_REACHED }) },
  { id: 'M1.0n', title: 'No target yet', note: 'Weighed in, no target: the ring shows the weight with an empty arc and the pill Set a target weight.',
    render: me({ S: S_NO_TARGET }) },
  { id: 'M1.0f', title: 'Food tracking off', note: 'No days-on-target slide and no kcal in My goal.', render: me({ food: false, goal: { ...GOAL_READY, profile: { calories: null } } }) },
  { id: 'M1.0x', title: 'No NutriTrace', note: 'This build keeps no profile: My goal says only the target weight; no food slide.',
    render: me({ food: false, goal: { status: 'no-nutrition', profile: { calories: null } }, invites: null }) },
  { id: 'M1.0l', title: 'My goal loading', note: 'NutriTrace settings still loading: the goal card is a skeleton; the weight is local and immediate.',
    render: me({ goal: { status: 'loading', profile: { calories: null } } }) },
  { id: 'M1.0m', title: 'A member', note: 'A member sees the plain line under Invite a friend (counts are the admin’s).', render: me({ invites: null }) },
  { id: 'M1.0s', title: 'No server', note: 'A build with no server (guest, demo) has no Invite action and no Invite a friend row.', render: me({ canInvite: false, invites: null }) },
])
