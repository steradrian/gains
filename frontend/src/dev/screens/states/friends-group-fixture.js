import { todayISO, weekKey } from '../../../lib/format.js'
import { plusDays } from '../../../lib/missed-day.js'
import { GROUP } from './friends-fixture.js'

// The Group page's mock (PR-09 group-m1): Iron Sunday as GET /groups/{id} answers it, this week,
// and its variants. Dates and times are built from today so a state never shows a stale week.
// Exports are never mutated; a variant spreads one. All of it lives in memory.

const TODAY = todayISO()
const MONDAY = weekKey(TODAY)
const NOW = Date.now()
const HOUR = 3600000

const person = (uid, name, done, planned, extra = {}) => ({
  uid, name, initial: name.charAt(0), done, planned, muted: false, you: uid === 'u-adrian', ...extra,
})

const PEOPLE = [['u-adrian', 'Adrian'], ['u-mara', 'Mara'], ['u-radu', 'Radu'], ['u-ioana', 'Ioana'], ['u-vlad', 'Vlad']]
const MEMBERS = [person('u-adrian', 'Adrian', 4, 4), person('u-mara', 'Mara', 3, 4), person('u-radu', 'Radu', 4, 5), person('u-ioana', 'Ioana', 3, 4), person('u-vlad', 'Vlad', 3, 5)]

// Workouts logged per day by anyone in the group; days after today have none yet.
const weekDays = counts => Array.from({ length: 7 }, (_, i) => {
  const date = plusDays(MONDAY, i)
  return { date, workouts: date <= TODAY ? counts[i] : 0 }
})

const CHALLENGE = {
  id: 'c-trains-3', template: 'workouts', title: 'Everyone trains 3× this week', span: 'week', state: 'active',
  start: MONDAY, end: plusDays(MONDAY, 6), total: 12, goal: 15, you: { in: true },
  joined: PEOPLE.map(([uid, name]) => ({ uid, name })), invited: [],
}

const MOMENTS = [
  { id: 'mo-legs', kind: 'workout', who: ['u-mara'], title: 'Mara finished Legs', detail: '54 min · 6 exercises', label: 'Legs', at: new Date(NOW - 2 * HOUR).toISOString(), cheered: false, mine: false },
  { id: 'mo-together', kind: 'together', who: ['u-adrian', 'u-ioana'], title: 'You and Ioana trained together', detail: 'Push A, same evening', label: 'Push A', at: new Date(NOW - 30 * HOUR).toISOString(), cheered: true, mine: false },
  { id: 'mo-best', kind: 'best', who: ['u-radu'], title: 'Radu set a new best', detail: 'Deadlift · he chose to share it', label: 'Deadlift', at: new Date(NOW - 30 * HOUR).toISOString(), cheered: true, mine: false },
  { id: 'mo-target', kind: 'target', who: ['u-vlad'], title: 'Vlad hit his protein target', detail: '5 of 7 days this week', label: 'protein target', at: new Date(NOW - 4 * 24 * HOUR).toISOString(), cheered: true, mine: false },
]

/** Iron Sunday as the viewer (Adrian, its creator) sees it mid-week: 17 of 22, 5 of 7 targets, a 4-week streak. */
export const GROUP_FULL = {
  ...GROUP,
  goal: { kind: 'planned' },
  creator: 'u-adrian',
  isCreator: true,
  muteNotifications: false,
  targets: { hit: 5, of: 7 },
  weekDays: weekDays([2, 1, 3, 2, 3, 4, 2]),
  members: MEMBERS,
  challenges: [CHALLENGE],
  moments: MOMENTS,
  cheersForMe: 3,
  quiet: false,
}

/** The same group for a member who is not its creator (Mara created it): the menu reads the same. */
export const GROUP_AS_MEMBER = { ...GROUP_FULL, creator: 'u-mara', isCreator: false }

/** Monday morning: nothing logged, the ring at 0 of 22, the streak still 4, a challenge not joined yet. */
export const GROUP_NO_ACTIVITY = {
  ...GROUP_FULL,
  week: { done: 0, planned: 22 },
  targets: { hit: 0, of: 7 },
  weekDays: weekDays([0, 0, 0, 0, 0, 0, 0]),
  members: MEMBERS.map(m => ({ ...m, done: 0 })),
  challenges: [{
    id: 'c-protein', template: 'protein', title: 'Protein target 5 of 7 days', span: 'week', state: 'active',
    start: MONDAY, end: plusDays(MONDAY, 6), total: 0, goal: 25, you: { in: false }, joined: [], invited: PEOPLE.map(([uid]) => uid),
  }],
  moments: [],
  cheersForMe: 0,
  quiet: true,
}

/** Vlad muted by the viewer: his moment is gone from the payload, he still counts in the ring. */
export const GROUP_MUTED = {
  ...GROUP_FULL,
  members: MEMBERS.map(m => (m.uid === 'u-vlad' ? { ...m, muted: true } : m)),
  moments: MOMENTS.filter(m => !m.who.includes('u-vlad')),
}

/** Just the viewer: the ring is theirs, and Invite sits where moments would be. */
export const GROUP_ALONE = {
  ...GROUP_FULL,
  name: 'Sunday crew',
  memberCount: 1,
  members: [person('u-adrian', 'Adrian', 3, 4)],
  week: { done: 3, planned: 4 },
  streak: 0,
  targets: { hit: 4, of: 7 },
  weekDays: weekDays([1, 0, 1, 0, 1, 0, 0]),
  challenges: [],
  moments: [],
  cheersForMe: 0,
}

/** Radu has no plan this week: no segment for him, "No plan" in the legend, nothing red. */
export const GROUP_GAP_WEEK = {
  ...GROUP_FULL,
  week: { done: 14, planned: 17 },
  members: MEMBERS.map(m => (m.uid === 'u-radu' ? { ...m, done: 0, planned: 0 } : m)),
}

/** Past the goal: 19 sessions done of 17 planned. The ring is full and stays calm. */
export const GROUP_OVER_GOAL = {
  ...GROUP_FULL,
  week: { done: 19, planned: 17 },
  members: [person('u-adrian', 'Adrian', 5, 4), person('u-mara', 'Mara', 4, 4), person('u-radu', 'Radu', 4, 4), person('u-ioana', 'Ioana', 3, 3), person('u-vlad', 'Vlad', 3, 2)],
}
