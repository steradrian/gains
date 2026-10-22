import { useLayoutEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { __setMockTogether } from '../../../lib/friends/use-together.js'
import SummaryScreen from '../../../views/workout/SummaryScreen.jsx'
import { registerScreens } from '../registry.js'
import { FriendsMock } from './friends-core.jsx'
import { GROUP, GROUP_QUIET, ME_OFF, ME_ON } from './friends-fixture.js'

// Friends surfaces m2 (board Fr7Summary, W2.3): the real workout summary page with its "Friends will
// see" block, on Push A of Sun 18 Oct against the Sunday before. Everything is in memory: the
// Friends cache is the fixture (FriendsMock), the "Trained together" moment is handed to the block
// without any request (__setMockTogether), and the workout lives in the mocked store only. Switching
// a row writes to that mocked store, never to the real one.

const MIN = 60000
const BENCH = '0025', FLY = '0227'
const DAY = '2026-10-18'
const at = (d, hm) => Date.parse(d + 'T' + hm + ':00')
const sets = (w, ...reps) => reps.map(r => ({ w, r, done: true }))
const PUSH = { id: 'g-push', name: 'Push A', emoji: 'dumbbell', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 80 }, { id: FLY, sets: 3, reps: 12, weight: 20 }] }

const BEFORE = [
  { id: 'g-w1', d: '2026-10-11', start: at('2026-10-11', '17:42'), end: at('2026-10-11', '18:34'), name: 'Push A', routineIds: ['g-push'], entries: [{ id: BENCH, rid: 'g-push', sets: sets(80, 7, 7, 7) }] },
]
const saved = share => ({
  id: 'g-w2', d: DAY, start: at(DAY, '17:42'), end: at(DAY, '17:42') + 52 * MIN, name: 'Push A', routineIds: ['g-push'], prs: [FLY],
  entries: [{ id: BENCH, rid: 'g-push', sets: sets(80, 8, 8, 7) }, { id: FLY, sets: sets(20, 12, 12, 12) }],
  ...(share && { share }),
})
const store = share => ({
  routines: [PUSH], week: {}, dayPlan: {}, dayNotes: {}, missedSeen: {}, queue: null, active: null,
  workouts: [...BEFORE, saved(share)], weighIn: false, bodyweight: [], unit: 'kg',
})

const USER = { id: 'u-adrian', name: 'Adrian' }
const PATH = '/train/workout/summary/g-w2'
const NONE = []
const ONE_GROUP = [GROUP]
const TWO_GROUPS = [GROUP, GROUP_QUIET]
const TOGETHER = [{ gid: GROUP.id, mid: 'm-together', names: ['Ioana'] }]

// Hands the block its "Trained together" moment for as long as the state shows.
function TogetherMock({ list, children }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const undo = __setMockTogether(list)
    setReady(true)
    return () => { setReady(false); undo() }
  }, [list])
  return ready ? children : null
}

const screen = (me, groups, together) => () => (
  <FriendsMock me={me} groups={groups}>
    <TogetherMock list={together}>
      <Routes><Route path="/train/workout/summary/:id" element={<SummaryScreen />} /></Routes>
    </TogetherMock>
  </FriendsMock>
)

const state = (id, title, note, share, render) => ({ id, title, note, path: PATH, mock: { user: USER, S: store(share) }, render })

registerScreens('Friends: surfaces', [
  state('friends-surfaces-summary', 'W2.3 Summary, Friends will see', 'Defaults: Push A done is on, Trained together with Ioana is on, the new best (Cable fly) is off, Don’t share this one is off.',
    undefined, screen(ME_ON, ONE_GROUP, TOGETHER)),
  state('friends-surfaces-summary-best', 'W2.3 Summary, a new best shared', 'New best: Cable fly switched on; the record holds the exercise id only.',
    { best: [FLY] }, screen(ME_ON, ONE_GROUP, TOGETHER)),
  state('friends-surfaces-summary-off', 'W2.3 Summary, Don’t share this one', 'Don’t share this one is on: Push A done reads off and the other rows are disabled.',
    { off: true, best: [FLY] }, screen(ME_ON, ONE_GROUP, TOGETHER)),
  state('friends-surfaces-summary-alone', 'W2.3 Summary, no one trained with you', 'No Trained together row: nobody logged the same routine the same day.',
    undefined, screen(ME_ON, ONE_GROUP, NONE)),
  state('friends-surfaces-summary-groups', 'W2.3 Summary, several groups', 'In two groups the title is Friends and the choices apply to both.',
    undefined, screen(ME_ON, TWO_GROUPS, TOGETHER)),
  state('friends-surfaces-summary-absent', 'W2.3 Summary, Friends off', 'Friends is off: the summary has no Friends block at all.',
    undefined, screen(ME_OFF, NONE, NONE)),
])
