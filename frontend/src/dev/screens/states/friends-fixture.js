import { previewRows } from '../../../lib/friends/share-copy.js'
import { __setMockFriends } from '../../../lib/friends/store.js'
import { todayISO, weekKey } from '../../../lib/format.js'
import { plusDays } from '../../../lib/missed-day.js'

// The Friends gallery's shared mock (PR-09): the group "Iron Sunday", the person's switches and
// what they let through. Later Friends milestones import this and add exports of their own; the
// exports here are never mutated. All of it lives in memory: `mockFriends` hands it to the Friends
// cache without any network, and puts the real cache back when the state is left.

const member = (uid, name) => ({ uid, name, initial: name.charAt(0) })

/** Iron Sunday: five members in join order, 17 of 22 sessions, a 4-week streak, one challenge running. */
export const GROUP = {
  id: 'g-iron-sunday',
  name: 'Iron Sunday',
  since: '2026-08-30',
  memberCount: 5,
  members: [member('u-adrian', 'Adrian'), member('u-mara', 'Mara'), member('u-radu', 'Radu'), member('u-ioana', 'Ioana'), member('u-vlad', 'Vlad')],
  week: { done: 17, planned: 22 },
  streak: 4,
  goalLine: 'Planned sessions',
  challengeLine: 'Everyone trains 3× this week · 12 of 15',
}

/** A group that is just you, in a week with no plan: no sessions line, no streak, no challenge. */
export const GROUP_QUIET = {
  id: 'g-quiet',
  name: 'Sunday crew',
  since: '2026-10-12',
  memberCount: 1,
  members: [member('u-adrian', 'Adrian')],
  week: { done: 0, planned: 0 },
  streak: 0,
  goalLine: 'Planned sessions',
}

/** The four switches of What you share: New bests is off until the person picks one by one. */
export const SHARE = { training: true, consistency: true, targets: true, bests: false }

/** GET /me for someone with Friends on and in Iron Sunday. */
export const ME_ON = { on: true, share: SHARE, groups: [GROUP], invitations: [], newCount: 0 }

/** GET /me with Friends off (its switches kept for when it is turned on again). */
export const ME_OFF = { on: false, share: SHARE, groups: [], invitations: [], newCount: 0 }

/** GET /me with Friends on and no group. */
export const ME_ON_NO_GROUP = { ...ME_ON, groups: [] }

const TODAY = todayISO()

// The person's own state the preview is computed from: four planned days, a workout on each of the
// first four days of this week, and five of the last seven days on target. `mock.S` of a Groups state.
function previewState(today) {
  const monday = plusDays(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7))
  const at = (day, hour) => new Date(day + 'T' + String(hour).padStart(2, '0') + ':00:00').getTime()
  const names = ['Push A', 'Pull A', 'Legs', 'Push B']
  return {
    unit: 'kg',
    routines: names.map((name, i) => ({ id: 'r' + i, name })),
    week: { 1: ['r0'], 2: ['r1'], 4: ['r2'], 5: ['r3'] },
    workouts: names.map((name, i) => {
      const d = plusDays(monday, i)
      return { id: 'w' + i, name, d, start: at(d, 18), end: at(d, 18) + 52 * 60000 }
    }),
    targetsReached: Object.fromEntries(Array.from({ length: 7 }, (_, k) => [plusDays(today, -k), { all: k !== 2 && k !== 5, protein: true }])),
  }
}

/** The preview's state: pass as `mock.S`. */
export const PREVIEW_STATE = previewState(TODAY)

/** What friends see of the person above with `SHARE`: training, the week, food targets, bests off. */
export const PREVIEW = previewRows(SHARE, PREVIEW_STATE, TODAY)

/**
 * Hands `me` and `groups` to the Friends cache for as long as the state shows: no network, no
 * storage. Returns the function that puts the real cache back. A gallery state calls it from a
 * component that mounts with the screen (FriendsMock in friends-core.jsx).
 */
export const mockFriends = ({ me, groups }) => __setMockFriends({ me, groups })

// Friends challenge m1: the challenge pages' mock (GET /groups/{id}/challenges/{cid}). Dates are
// built from today so a state never shows a stale week; a variant spreads one, nothing is mutated.
const MONDAY = weekKey(TODAY)
const PEOPLE = [['u-adrian', 'Adrian'], ['u-mara', 'Mara'], ['u-radu', 'Radu'], ['u-ioana', 'Ioana'], ['u-vlad', 'Vlad']]
const joinedOf = (counts, planned = 3, people = PEOPLE) => people.map(([uid, name], i) => ({ uid, name, count: counts[i], planned }))

/** Everyone trains 3x this week, running, the viewer in: 12 of 15, Radu started it. */
export const CHALLENGE_ACTIVE = {
  id: 'c-trains-3',
  template: 'workouts',
  title: 'Everyone trains 3× this week',
  detail: 'Counts finished workouts',
  span: 'week',
  state: 'active',
  start: MONDAY,
  end: plusDays(MONDAY, 6),
  total: 12,
  goal: 15,
  perPerson: 3,
  joined: joinedOf([2, 3, 3, 3, 1]),
  invited: [],
  you: { in: true },
  startedBy: { uid: 'u-radu', name: 'Radu' },
}

/** The same challenge before the viewer says yes: four are in, the viewer is invited. */
export const CHALLENGE_NOT_JOINED = {
  ...CHALLENGE_ACTIVE,
  total: 9,
  goal: 12,
  joined: joinedOf([3, 2, 3, 1], 3, PEOPLE.slice(1)),
  invited: ['u-adrian'],
  you: { in: false },
}

/** Protein target, three of five in so far: two invited and not joined, shown dimmed. */
export const CHALLENGE_THREE = {
  ...CHALLENGE_ACTIVE,
  id: 'c-protein',
  template: 'protein',
  title: 'Protein target 5 of 7 days',
  detail: 'Counts days each of you reached it',
  total: 8,
  goal: 15,
  perPerson: 5,
  joined: joinedOf([3, 2, 3], 5, PEOPLE.slice(0, 3)),
  invited: ['u-ioana', 'u-vlad'],
}

/** Finished last week with the goal hit: 15 of 15, the goal hit five weeks in a row. */
export const CHALLENGE_DONE = {
  ...CHALLENGE_ACTIVE,
  state: 'done',
  start: plusDays(MONDAY, -7),
  end: plusDays(MONDAY, -1),
  total: 15,
  goal: 15,
  joined: joinedOf([3, 3, 3, 3, 3]),
  streak: 5,
}

/** Done for the first time: no run of weeks to say. */
export const CHALLENGE_DONE_NO_STREAK = { ...CHALLENGE_DONE, streak: 0 }

/** Ended short of the goal: 11 of 15, said as how far the group got and nothing else. */
export const CHALLENGE_MISSED = {
  ...CHALLENGE_DONE,
  state: 'missed',
  total: 11,
  joined: joinedOf([3, 3, 2, 2, 1]),
  streak: 0,
}

const trainingState = week => ({
  unit: 'kg',
  routines: [{ id: 'r-push', name: 'Push A', ex: [{ id: 'bench' }] }],
  week,
  dayPlan: {},
  dayNotes: {},
  missedSeen: {},
  queue: null,
  active: null,
  workouts: [],
})

/** `mock.S` with Push A planned for today: the Start action shows. */
export const PLANNED_TODAY_STATE = trainingState({ [new Date(TODAY + 'T12:00:00').getDay()]: ['r-push'] })

/** `mock.S` with nothing planned today: no Start action. */
export const REST_TODAY_STATE = trainingState({})
