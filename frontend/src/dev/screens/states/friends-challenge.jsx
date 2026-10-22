import { useLayoutEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { __setMockChallenge } from '../../../lib/friends/use-challenge.js'
import { __setMockGroup } from '../../../lib/friends/use-group.js'
import { newChallengeSheet } from '../../../components/NewChallengeSheet.jsx'
import { useUI } from '../../../store/useUI.js'
import ChallengeScreen from '../../../views/friends/ChallengeScreen.jsx'
import GroupScreen from '../../../views/friends/GroupScreen.jsx'
import { registerScreens } from '../registry.js'
import {
  CHALLENGE_ACTIVE, CHALLENGE_DONE, CHALLENGE_DONE_NO_STREAK, CHALLENGE_MISSED, CHALLENGE_NOT_JOINED, CHALLENGE_THREE,
  GROUP, ME_ON, PLANNED_TODAY_STATE, REST_TODAY_STATE, mockFriends,
} from './friends-fixture.js'
import { GROUP_FULL } from './friends-group-fixture.js'

// Friends challenge m1 (boards Fr3New, Fr3Join, Fr3Challenge, Fr3Done, and the missed and leave
// edges): the real Challenge page and New challenge drawer over the in-memory caches. Nothing here
// touches the network or real storage: the group, the challenge and the Friends cache are in
// memory, and Count me in and Leave only change that copy.
const USER = { id: 'u-adrian', name: 'Adrian' }
const mock = S => ({ user: USER, S })
const PATH = '/me/groups/' + GROUP.id + '/challenge/'
const GROUP_PATH = '/me/groups/' + GROUP.id

const running = n => ({ id: 'c-extra-' + n, template: 'workouts', title: 'Challenge ' + n, state: 'active', start: CHALLENGE_ACTIVE.start, end: CHALLENGE_ACTIVE.end, total: 4, goal: 15, you: { in: true }, joined: [], invited: [] })
const GROUP_FULL_OF_CHALLENGES = { ...GROUP_FULL, challenges: [running(1), running(2), running(3)] }

// Lays the group and (when given) the challenge over the caches for as long as the state shows,
// then puts the real ones back.
function ChallengeMock({ group, challenge, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undoFriends = mockFriends({ me: ME_ON, groups: [GROUP] })
    const undoGroup = __setMockGroup(GROUP.id, group)
    const undoChallenge = challenge ? __setMockChallenge(GROUP.id, challenge.id, challenge) : () => {}
    setReady(true)
    return () => { setReady(false); undoChallenge(); undoGroup(); undoFriends() }
  }, [group, challenge])
  return ready ? children : null
}

const page = challenge => () => (
  <ChallengeMock group={GROUP_FULL} challenge={challenge}>
    <Routes><Route path="/me/groups/:id/challenge/:cid" element={<ChallengeScreen />} /></Routes>
  </ChallengeMock>
)

const groupPage = group => () => (
  <ChallengeMock group={group}>
    <Routes><Route path="/me/groups/:id" element={<GroupScreen />} /></Routes>
  </ChallengeMock>
)

const holdToast = async tools => { await tools.wait(300); useUI.getState().pauseToast() }

registerScreens('Friends: challenge', [
  { id: 'friends-challenge-new', title: 'M6.13 New challenge', note: 'The drawer over the group: four templates with what each counts (Everyone trains 3x chosen), How long on This week, the explanation and Start challenge.',
    path: GROUP_PATH, mock: mock(PLANNED_TODAY_STATE), render: groupPage(GROUP_FULL),
    play: async tools => { newChallengeSheet(GROUP.id); await tools.wait(400) } },
  { id: 'friends-challenge-new-full', title: 'M6.13 New challenge, three already running', note: 'The group has three challenges going: one line says why, and Start challenge is off.',
    path: GROUP_PATH, mock: mock(PLANNED_TODAY_STATE), render: groupPage(GROUP_FULL_OF_CHALLENGES),
    play: async tools => { newChallengeSheet(GROUP.id); await tools.wait(400) } },
  { id: 'friends-challenge-new-picked', title: 'M6.13 New challenge, Weekend moving for a month', note: 'Another template and length picked: the mark moves and the segment slides.',
    path: GROUP_PATH, mock: mock(PLANNED_TODAY_STATE), render: groupPage(GROUP_FULL),
    play: async tools => {
      newChallengeSheet(GROUP.id)
      await tools.wait(400)
      // A template's row also holds its counts line, so it is found by where its text starts.
      const row = [...document.querySelectorAll('[role="radio"]')].find(el => el.textContent.startsWith('Weekend moving'))
      row?.click()
      await tools.click('This month')
      await tools.wait(300)
    } },
  { id: 'friends-challenge-join', title: 'M6.14 Challenge, not joined', note: 'Nine of twelve so far: the shared bar, Count me in with what joining does to the goal, and Who\'s in with the viewer invited and dimmed.',
    path: PATH + CHALLENGE_NOT_JOINED.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_NOT_JOINED) },
  { id: 'friends-challenge', title: 'M6.12 Challenge, joined, with a workout planned', note: '12 of 15: one bar, a colour per person in join order, Start Push A with "Workout 3 of 3 counts the moment you finish", Who\'s in and a quiet Leave challenge.',
    path: PATH + CHALLENGE_ACTIVE.id, mock: mock(PLANNED_TODAY_STATE), render: page(CHALLENGE_ACTIVE) },
  { id: 'friends-challenge-no-plan', title: 'M6.12 Challenge, joined, nothing planned today', note: 'The same page on a rest day: no Start action and no caption under the bar.',
    path: PATH + CHALLENGE_ACTIVE.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_ACTIVE) },
  { id: 'friends-challenge-three', title: 'M6.12 A bar with three people in', note: 'Protein target: three colours on the bar, two people invited and dimmed, the caption says what counts.',
    path: PATH + CHALLENGE_THREE.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_THREE) },
  { id: 'friends-challenge-left', title: 'M6.12 Left the challenge (toast held)', note: 'Leave challenge took the viewer off at once; the page is the not-joined one and the toast "Left the challenge" with Undo is held open.',
    path: PATH + CHALLENGE_ACTIVE.id, mock: mock(PLANNED_TODAY_STATE), render: page(CHALLENGE_ACTIVE),
    play: async tools => { await tools.click('Leave challenge'); await holdToast(tools) } },
  { id: 'friends-challenge-done', title: 'M6.15 Challenge done', note: 'You did it, together: the line-art, 15 of 15 workouts, Goal hit 5 weeks in a row · 5 of 5 in, Cheer everyone and Pick next week\'s challenge.',
    path: PATH + CHALLENGE_DONE.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_DONE) },
  { id: 'friends-challenge-done-no-streak', title: 'M6.15 Challenge done, first time', note: 'No run of weeks to say, so the streak line is left out.',
    path: PATH + CHALLENGE_DONE_NO_STREAK.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_DONE_NO_STREAK) },
  { id: 'friends-challenge-missed', title: 'M6.15 Challenge ended short', note: '11 of 15 workouts, Ended: how far the group got and nobody named, no red; Pick next week\'s challenge.',
    path: PATH + CHALLENGE_MISSED.id, mock: mock(REST_TODAY_STATE), render: page(CHALLENGE_MISSED) },
])
