import { dateLocale, t, tn } from '../i18n.js'
import { fmtAgo, fmtDate, fmtDateRange, fmtMonth, todayISO } from '../format.js'
import { memberTone } from '../../ds/MemberAvatar.jsx'

// What the Group page says, in words and shapes (boards Fr2Group, Fr2NoActivity, Fr2Muted): one
// place that turns the payload into the ring's segments, the legend, the header line and the
// moment rows. A line appears only when the data backs it: no "since" without a date, no streak
// at 0, no targets line when nobody shares targets, no "of 0".

const DAY_MS = 86400000

/** The member at `index` in join order has the same colour on every screen. */
export const toneOfMember = (group, uid) => memberTone(Math.max(0, group.members.findIndex(m => m.uid === uid)))

/** "5 friends · since August"; "Just you · since October" alone; the month only when `since` is a date. */
export function headerLine(group) {
  const n = group.members.length
  const people = n > 1 ? tn('{0} friend', '{0} friends', n) : t('Just you')
  if (group.quiet && group.weekDays[0]?.date) return t('{0} · new week', fmtDate(group.weekDays[0].date, true))
  return group.since ? t('{0} · since {1}', people, fmtMonth(group.since, true, { yearIfOld: true })) : people
}

/** What the ring counts, by the group's goal. */
export function weekUnit(group) {
  const kind = group.goal?.kind
  if (kind === 'targets') return t('targets hit')
  if (kind === 'number') return t('sessions')
  return t('planned sessions')
}

/** One segment per member with a plan this week, in join order; a week off adds none and is never marked. */
export function ringSegments(group) {
  return group.members
    .map((m, i) => ({ m, tone: memberTone(i) }))
    .filter(({ m }) => m.planned > 0)
    .map(({ m, tone }) => ({ value: m.done, of: m.planned, tone }))
}

/** The legend rows, in join order: the name ("You" for the viewer) and "4 of 4" or "No plan". */
export function legendRows(group) {
  return group.members.map((m, i) => ({
    uid: m.uid,
    initial: m.initial || m.name,
    tone: memberTone(i),
    name: m.you ? t('You') : m.name,
    text: m.planned > 0 ? t('{0} of {1}', m.done, m.planned) : t('No plan'),
  }))
}

/** The ring's spoken summary: the totals and the unit, never bare numbers. */
export const ringLabel = group => t('{0} of {1} {2}', group.week.done, group.week.planned, weekUnit(group))

/** "5 of 7 targets hit", only while anyone shares targets and the week has started. */
export const targetsLine = group => (!group.quiet && group.targets?.of > 0 ? t('{0} of {1} targets hit', group.targets.hit, group.targets.of) : null)

/** "4-week streak", or in a quiet week "Goal hit 4 weeks in a row"; nothing at 0 (a missed week resets quietly). */
export function streakLine(group) {
  if (!(group.streak > 0)) return null
  return group.quiet
    ? tn('Goal hit {0} week in a row', 'Goal hit {0} weeks in a row', group.streak)
    : t('{0}-week streak', group.streak)
}

/** The seven day cells of "This week together": a dot where anyone in the group logged a workout. */
export function weekCells(group, today = todayISO()) {
  return group.weekDays.map(d => {
    const when = new Date(d.date + 'T12:00:00')
    const done = d.workouts > 0
    return {
      key: d.date,
      dow: when.toLocaleDateString(dateLocale(), { weekday: 'narrow' }),
      date: when.getDate(),
      training: done ? 'done' : 'rest',
      today: d.date === today,
      label: t('{0}: {1}', fmtDate(d.date, true), done ? tn('{0} workout logged', '{0} workouts logged', d.workouts) : t('No workout logged')),
    }
  })
}

/** When a moment happened: "2 hours ago", "yesterday", then the weekday for older ones. */
export function momentTime(at, now = Date.now()) {
  const ts = typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ts)) return ''
  return now - ts < 2 * DAY_MS ? fmtAgo(ts, now) : new Date(ts).toLocaleDateString(dateLocale(), { weekday: 'short' })
}

/** The tag over a moment's title: only a new best and a reached target carry one. */
export function momentKind(kind) {
  if (kind === 'best') return t('NEW BEST')
  if (kind === 'target') return t('Target reached')
  return null
}

/** Who a moment is about, as the initials to draw: everyone in `who`, in join order. */
export function momentPeople(group, moment) {
  return group.members
    .map((m, i) => ({ m, tone: memberTone(i) }))
    .filter(({ m }) => moment.who?.includes(m.uid))
    .map(({ m, tone }) => ({ uid: m.uid, initial: m.initial || m.name, tone }))
}

/** "Cheered Mara's Legs": whose it was and what, from `label`; just the name when the payload has no label. */
export function cheerToastText(group, moment) {
  const other = group.members.find(m => moment.who?.includes(m.uid) && !m.you)
  if (!other) return t('Cheered')
  return moment.label ? t("Cheered {0}'s {1}", other.name, moment.label) : t('Cheered {0}', other.name)
}

const UNITS = { workouts: () => t('workouts'), protein: () => t('days'), weekend: () => t('days'), bests: () => t('bests') }

/**
 * A challenge row's lines: the dates ("Mon 12 Oct – Sun 18 Oct", with "ends tonight" or "starts
 * today" when that is true), the progress ("Joined 12 of 15 workouts" or "Not joined 0 of 25 days")
 * and who is in it or invited, in join order.
 */
export function challengeRow(group, ch, today = todayISO()) {
  const when = ch.end === today ? t('ends tonight') : ch.start === today ? t('starts today') : null
  const dates = fmtDateRange(ch.start, ch.end, true)
  const unit = (UNITS[ch.template] || UNITS.workouts)()
  const ids = new Set([...(ch.joined || []).map(j => j.uid ?? j), ...(ch.invited || [])])
  return {
    id: ch.id,
    title: ch.title,
    dates: when ? t('{0} · {1}', dates, when) : dates,
    progress: ch.you?.in ? t('Joined {0} of {1} {2}', ch.total ?? 0, ch.goal ?? 0, unit) : t('Not joined {0} of {1} {2}', ch.total ?? 0, ch.goal ?? 0, unit),
    people: group.members
      .map((m, i) => ({ m, tone: memberTone(i) }))
      .filter(({ m }) => ids.has(m.uid))
      .map(({ m, tone }) => ({ uid: m.uid, initial: m.initial || m.name, tone })),
  }
}

/** Who to name on Groups after leaving ("Ask Mara for a new invite"): the creator's first name, unless that is the viewer. Undefined when not known. */
export function leaveBy(group) {
  const creator = group.members.find(m => m.uid === group.creator && !m.you)
  return creator?.name?.trim().split(/\s+/)[0] || undefined
}

/** The Group menu's line under "What you share here": the switches that are on, "Training, consistency, targets". Null with none on. */
export function sharedLine(share) {
  if (!share) return null
  const parts = [share.training && t('training'), share.consistency && t('consistency'), share.targets && t('targets'), share.bests && t('new bests')].filter(Boolean)
  if (!parts.length) return null
  const line = parts.join(', ')
  return line.charAt(0).toLocaleUpperCase(dateLocale()) + line.slice(1)
}

/** The line over the Cheers for you link. */
export const cheersForMeText = n => tn('{0} cheer for you', '{0} cheers for you', n)
