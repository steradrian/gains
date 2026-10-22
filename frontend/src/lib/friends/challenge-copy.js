import { fmtDateRange, todayISO } from '../format.js'
import { t, tn } from '../i18n.js'
import { trainingDay } from '../training-day.js'
import { memberTone } from '../../ds/MemberAvatar.jsx'
import { challengeUnit } from './group-copy.js'

// What the challenge pages say, in words and shapes (boards Fr3New, Fr3Join, Fr3Challenge,
// Fr3Done): one place that turns the payload into the template picker, the dates and end lines,
// the bar's segments, the Who's in rows and the done / missed sentences. A line appears only when
// the data backs it: no "started by" without who, no "your 3rd" without a count to reach, no
// streak at 0. Nobody is named for falling short and nothing is red.

/** Active challenges a group can run at once (the server refuses a fourth: `challenge-limit`). */
export const CHALLENGE_LIMIT = 3

export const DEFAULT_TEMPLATE = 'workouts'
export const DEFAULT_SPAN = 'week'

/** The four templates in the order of the board, with what each one counts. */
export const templates = () => [
  { id: 'workouts', title: t('Everyone trains 3× this week'), counts: t('Counts finished workouts') },
  { id: 'protein', title: t('Protein target 5 of 7 days'), counts: t('Counts days each of you reached it') },
  { id: 'weekend', title: t('Weekend moving'), counts: t('An activity or a workout on Saturday and Sunday') },
  { id: 'bests', title: t('Each of us beats one best'), counts: t('Any new best set, shared or not') },
]

/** What a template counts, for the line under a joined challenge. */
export const countsLine = template => (templates().find(x => x.id === template) || templates()[0]).counts

/** How long, in the order of the board. */
export const spans = () => [
  { value: 'week', label: t('This week') },
  { value: 'twoWeeks', label: t('2 weeks') },
  { value: 'month', label: t('This month') },
]

/** How many of the group's challenges are running (a summary without a `state` is running). */
export const activeCount = group => (group?.challenges || []).filter(c => (c.state || 'active') === 'active').length

const daysBetween = (from, to) => Math.round((Date.parse(to + 'T12:00:00') - Date.parse(from + 'T12:00:00')) / 864e5)

/** "ends tonight", "ends tomorrow", "3 days left"; null once the last day is over. */
export function endPhrase(end, today = todayISO()) {
  const days = daysBetween(today, end)
  if (!(days >= 0)) return null
  if (days === 0) return t('ends tonight')
  if (days === 1) return t('ends tomorrow')
  return tn('{0} day left', '{0} days left', days)
}

/** "Mon 12 Oct – Sun 18 Oct · started by Radu"; the last part only when the payload says who. */
export function datesLine(ch, me) {
  const dates = fmtDateRange(ch.start, ch.end, true)
  const by = ch.startedBy?.name
  if (!by) return dates
  return t('{0} · {1}', dates, ch.startedBy.uid && ch.startedBy.uid === me ? t('started by you') : t('started by {0}', by))
}

/** What each person counts toward the goal, as the payload says it (workouts: 3 a week); null when it is not there. */
export const perPerson = ch => (ch.perPerson > 0 ? ch.perPerson : null)

/** The count the person is still to reach: `{ next, of }`, or null once they have reached it (or are not in). */
export function toReach(ch, me) {
  const mine = (ch.joined || []).find(j => j.uid === me)
  const of = mine ? (mine.planned > 0 ? mine.planned : perPerson(ch)) : null
  const count = mine?.count ?? 0
  return mine && of > count ? { next: count + 1, of } : null
}

/** What counted so far: the payload's total, else the sum of what each person counted. */
export const totalOf = ch => ch.total ?? (ch.joined || []).reduce((n, j) => n + (j.count || 0), 0)

/** "11 of 15 workouts", for the bar's spoken label and the missed line. */
export const progressText = ch => t('{0} of {1} {2}', totalOf(ch), ch.goal ?? 0, challengeUnit(ch.template))

/** The caption under the bar. */
export const barCaption = ch => t("One shared bar. Each colour is someone's {0}, in the order you joined.", challengeUnit(ch.template))

/** The line under Count me in: what joining does to the goal, with the number only when it is the same for everyone. */
export function joinCaption(ch) {
  const per = perPerson(ch)
  return per
    ? t('Joining adds your {0} to the goal. Leaving later takes them off, nothing else.', per)
    : t('Joining adds your part to the goal. Leaving later takes your count off, nothing else.')
}

/** The line over Start <routine> once the person has more to count. */
export const startCaption = ({ next, of }) => t("Workout {0} of {1} counts the moment you finish today's workout.", next, of)

// A person keeps the colour they have in the group, so the bar and the Group page agree; without
// the group (not loaded) the order they joined the challenge gives it.
const toneOf = (members, uid, fallback) => {
  const at = members.findIndex(m => m.uid === uid)
  return memberTone(at >= 0 ? at : fallback)
}

/** The bar's segments, in the order people joined: `{ uid, value, tone, label }`. */
export function barSegments(ch, group) {
  const members = group?.members || []
  return (ch.joined || []).map((j, i) => ({
    uid: j.uid,
    value: j.count || 0,
    tone: toneOf(members, j.uid, i),
    label: t('{0}: {1}', j.name, j.count || 0),
  }))
}

/**
 * The rows of Who's in: everyone who joined in join order, then the people invited who have not
 * (named from the group; an invited uid the group cannot name is left out). Each has the initial and
 * colour to draw, the name, `you`, and the end text ("3 of 3", or "Invited" with `invited` true).
 */
export function whoRows(ch, group, me) {
  const members = group?.members || []
  const joined = (ch.joined || []).map((j, i) => {
    const m = members.find(x => x.uid === j.uid)
    return {
      uid: j.uid,
      initial: m?.initial || j.name,
      tone: toneOf(members, j.uid, i),
      name: j.name,
      you: j.uid === me,
      invited: false,
      end: j.planned > 0 ? t('{0} of {1}', j.count || 0, j.planned) : String(j.count || 0),
    }
  })
  const here = new Set(joined.map(r => r.uid))
  const invited = (ch.invited || [])
    .filter(uid => !here.has(uid))
    .map(uid => ({ uid, i: members.findIndex(m => m.uid === uid) }))
    .filter(x => x.i >= 0)
    .map(({ uid, i }) => ({
      uid, initial: members[i].initial || members[i].name, tone: memberTone(i), name: members[i].name,
      you: uid === me, invited: true, end: t('Invited'),
    }))
  return [...joined, ...invited]
}

/** "5 of 5": who joined of everyone the group has, so an empty `invited` list still reads true. */
export function inCount(ch, group) {
  const joined = (ch.joined || []).length
  const all = Math.max(group?.members?.length || 0, joined + (ch.invited || []).length)
  return { joined, all }
}

/** "Goal hit 5 weeks in a row · 5 of 5 in"; null when the goal has not been hit in a row (streak at 0 says nothing). */
export function streakLine(ch, group) {
  if (!(ch.streak > 0)) return null
  const { joined, all } = inCount(ch, group)
  return t('{0} · {1}', tn('Goal hit {0} week in a row', 'Goal hit {0} weeks in a row', ch.streak), t('{0} of {1} in', joined, all))
}

/** The done sentences: "15 of 15 workouts. Everyone trained 3 times this week." (the second only for workouts that were the same for everyone). */
export function doneText(ch) {
  const total = t('{0} of {1} {2}.', totalOf(ch), ch.goal ?? 0, challengeUnit(ch.template))
  const per = perPerson(ch)
  if (ch.template !== 'workouts' || !per) return total
  return t('{0} {1}', total, ch.span === 'week' || !ch.span ? t('Everyone trained {0} times this week.', per) : t('Everyone trained {0} times.', per))
}

/** Today's planned training, `{ name, ids }`, or null when nothing is planned (a rest day, running, done). */
export function plannedToday(S, today = todayISO()) {
  if (!S?.routines) return null
  const day = trainingDay(S, today, today)
  return day.kind === 'planned' ? { name: day.name, ids: day.ids } : null
}
