import { fmtDateRange, todayISO } from '../../../lib/format.js'
import { serverWeekKey } from '../../../lib/friends/member-view.js'
import { plusDays } from '../../../lib/missed-day.js'
import { GROUP } from './friends-fixture.js'

// Friends group m2's mock (boards Fr2Member, Fr2Gap, Fr2MemberMenu, Fr2Remove, Fr2Removed): Iron
// Sunday as GET /groups/{id} answers it for the viewer (Adrian, who created it), and the member
// payloads GET /groups/{id}/members/{uid} gives for the people on the boards. Dates follow the
// real calendar so the week cells and the W-labels always line up with today. Nothing here is
// mutated by a state; it lives in memory only.

const TODAY = todayISO()
const MONDAY = serverWeekKey(TODAY)
const ago = n => plusDays(TODAY, -n)
const weeksAgo = n => plusDays(MONDAY, -7 * n)

const ALL = { training: true, consistency: true, targets: true, bests: true }

const person = (uid, name, done, planned, extra = {}) => ({
  uid, name, initial: name.charAt(0), done, planned, muted: false, you: false, ...extra,
})

// 22 planned sessions between five people, 17 done: the board's figures.
const PEOPLE = [
  person('u-adrian', 'Adrian', 4, 4, { you: true }),
  person('u-mara', 'Mara', 3, 4),
  person('u-radu', 'Radu', 4, 5),
  person('u-ioana', 'Ioana', 3, 4),
  person('u-vlad', 'Vlad', 3, 5),
]

const CHALLENGE = {
  id: 'c-three-times',
  template: 'workouts',
  title: 'Everyone trains 3× this week',
  detail: fmtDateRange(MONDAY, plusDays(MONDAY, 6), true) + ' · ends tonight',
  total: 15,
  count: 12,
}

const MOMENTS = [
  { id: 'm1', kind: 'together', who: ['u-adrian', 'u-ioana'], title: 'Trained together', detail: 'You and Ioana trained together', at: 'earlier today', cheered: false, mine: true },
  { id: 'm2', kind: 'best', who: ['u-radu'], title: 'Radu set a new best', detail: 'Deadlift', at: 'yesterday', cheered: false, mine: false },
  { id: 'm3', kind: 'target', who: ['u-vlad'], title: 'Vlad hit his protein target', detail: '5 of 7 days this week', at: 'yesterday', cheered: false, mine: false },
]

const WEEK_DAYS = [3, 2, 3, 2, 2, 1, 1].map((workouts, i) => ({ date: plusDays(MONDAY, i), workouts }))

/** Iron Sunday as the Group answers for its creator, Adrian: five members, 17 of 22. */
export const GROUP_FULL = {
  ...GROUP,
  goal: { kind: 'planned' },
  creator: 'u-adrian',
  isCreator: true,
  targets: { hit: 5, of: 7 },
  weekDays: WEEK_DAYS,
  members: PEOPLE,
  challenges: [CHALLENGE],
  moments: MOMENTS,
  cheersForMe: 3,
  quiet: false,
}

/** The same group for a member who did not create it (Mara did): no Remove from group. */
export const GROUP_NOT_CREATOR = {
  ...GROUP_FULL,
  creator: 'u-mara',
  isCreator: false,
}

/** `group` with `uid` muted for the viewer (the menu then says Unmute). */
export const groupWithMuted = (group, uid, muted = true) => ({
  ...group,
  members: group.members.map(m => (m.uid === uid ? { ...m, muted } : m)),
})

/** Iron Sunday after Mara is removed: four friends, 14 of 18 planned sessions (Fr2Removed). */
export const GROUP_WITHOUT_MARA = {
  ...GROUP_FULL,
  memberCount: 4,
  members: PEOPLE.filter(p => p.uid !== 'u-mara'),
  week: { done: 14, planned: 18 },
}

/** The summary of it, as the Groups list holds it. */
export const GROUP_WITHOUT_MARA_SUMMARY = {
  ...GROUP,
  memberCount: 4,
  members: GROUP.members.filter(m => m.uid !== 'u-mara'),
  week: { done: 14, planned: 18 },
}

const CONSISTENCY = [1, 0.75, 1, null, 0.5, 1, 0.75, 0.5].map((share, i) => ({ week: weeksAgo(7 - i), share }))
const TARGETS = { reached: 5, of: 7, days: [true, true, false, true, true, false, true] }

const base = (uid, name, extra) => ({ uid, name, since: GROUP.since, cheered: false, shares: ALL, ...extra })

/** Mara shares everything: this week 3 of 4, three workouts, eight weeks, food targets, one best (Fr2Member). */
export const MEMBER_MARA = base('u-mara', 'Mara', {
  week: { done: 3, planned: 4, days: [true, false, true, false, true, false, false] },
  recent: [
    { title: 'Legs', date: ago(1), minutes: 54 },
    { title: 'Pull A', date: ago(3), minutes: 48 },
    { title: 'Push A', date: ago(4), minutes: 51 },
  ],
  consistency: CONSISTENCY,
  targets: TARGETS,
  bests: [{ exercise: 'Romanian deadlift', date: ago(1) }],
})

/** Mara after the viewer cheered her week: the pill says Cheered. */
export const MEMBER_MARA_CHEERED = { ...MEMBER_MARA, cheered: true }

/** Vlad took the week off (Fr2Gap): no week, no recent workouts, no bests; consistency and targets stay. */
export const MEMBER_VLAD_GAP = base('u-vlad', 'Vlad', {
  week: { noPlan: true },
  consistency: CONSISTENCY,
  targets: TARGETS,
})

/** Radu shares only his training: the page lists what he keeps off in the footer. */
export const MEMBER_RADU_SOME_OFF = base('u-radu', 'Radu', {
  shares: { training: true, consistency: false, targets: false, bests: false },
  week: { done: 4, planned: 5, days: [true, true, false, true, true, false, false] },
  recent: [
    { title: 'Push B', date: ago(0), minutes: 62 },
    { title: 'Push B', date: ago(2), minutes: 58 },
  ],
})

/** Ioana has every switch off: the server sends no section at all. */
export const MEMBER_IOANA_NOTHING = base('u-ioana', 'Ioana', {
  shares: { training: false, consistency: false, targets: false, bests: false },
})

/** The viewer's own page: the same payload shape, no Cheer pill and no menu. */
export const MEMBER_SELF = base('u-adrian', 'Adrian', {
  week: { done: 4, planned: 4, days: [true, true, false, true, true, false, false] },
  recent: [{ title: 'Push A', date: ago(0), minutes: 52 }],
  consistency: CONSISTENCY,
  targets: TARGETS,
})
