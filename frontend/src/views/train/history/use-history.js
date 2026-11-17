// History (board T8.0, /train/history) and the workout drawer's muscle line (T8.1): what they
// say, worked out from the store's state with no React in it, so it can be tested on its own.
import { dateLocale, t, tn } from '../../../lib/i18n.js'
import { durPart, fmtDate, isoOf, weekDayOffset, weekKey, weekOrder, weekStartOf } from '../../../lib/format.js'
import { workoutDay, workoutDuration, workoutVolume } from '../../../lib/history.js'
import { dayNoteOf } from '../../../lib/day-notes.js'
import { EXIDX, figureOf, imgSrc } from '../../../lib/exercises.js'
import { workoutMediaOf } from '../../../lib/media-refs.js'
import { loadOfWorkouts, MUSCLE_NAME, rankOf } from '../../../lib/muscles.js'
import { volumeText } from '../../../lib/train-stats.js'

// The stills on a row (the board stacks three).
const THUMBS = 3
const dayOf = w => workoutDay(w) || w?.d || null
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }

/**
 * Newest first: every workout, and in between them the days off you left a note on (#261). A
 * note on a day that has a workout too stays in the day sheet; the workout speaks for that day.
 * Rows are `{ d, w }` or `{ d, note }`.
 */
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes]
  // Stable, so workouts keep the order they are stored in (by day, then start) within a day.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}

/**
 * The rows by week (the profile's first weekday), newest first: `[{ key, title, workouts, rows }]`
 * where `key` is the week's first day, `title` "This week", "Last week" or "Week of 28 Sep", and
 * `workouts` how many workouts it holds (its day notes do not count).
 */
export function historyWeeks(S, today) {
  const ws = weekStartOf(S)
  const thisWeek = weekKey(today, ws)
  const lastWeek = weekKey(plusDays(thisWeek, -7), ws)
  const weeks = []
  for (const r of historyRows(S)) {
    const day = r.w ? dayOf(r.w) : r.d
    if (!day) continue
    const key = weekKey(day, ws)
    let week = weeks.find(x => x.key === key)
    if (!week) { week = { key, workouts: 0, rows: [] }; weeks.push(week) }
    week.rows.push(r)
    if (r.w) week.workouts += 1
  }
  return weeks.map(w => ({
    ...w,
    title: w.key === thisWeek ? t('This week') : w.key === lastWeek ? t('Last week') : t('Week of {0}', fmtDate(w.key)),
  }))
}

/** "24 workouts since August" (with the year when that was another year); null without workouts. */
export function historySub(S, today) {
  const days = (S.workouts || []).map(dayOf).filter(Boolean).sort()
  if (!days.length) return null
  const first = new Date(days[0] + 'T12:00:00')
  const month = first.toLocaleDateString(dateLocale(), first.getFullYear() === Number(today.slice(0, 4)) ? { month: 'long' } : { month: 'long', year: 'numeric' })
  return t('{0} since {1}', tn('{0} workout', '{0} workouts', days.length), month)
}

/**
 * A workout's row line: "Mon 12 Oct · 52 min · 9,600 kg · 2 new bests", the volume by Train's
 * rule (tonnes from 10 000 kg), and how many photos or videos it carries when it has some.
 */
export function workoutLine(w, unit) {
  const day = dayOf(w)
  const bests = w.prs?.length || 0
  const media = workoutMediaOf(w, Infinity).length
  return [
    day && fmtDate(day, true),
    ...durPart(workoutDuration(w)),
    volumeText(w.vol ?? workoutVolume(w), unit),
    bests > 0 && tn('{0} new best', '{0} new bests', bests),
    media > 0 && tn('{0} photo or video', '{0} photos or videos', media),
  ].filter(Boolean).join(' · ')
}

/** The stills of a workout's first exercises, null where an exercise has no picture. */
export function workoutThumbs(S, w) {
  const figure = figureOf(S)
  return (w.entries || []).slice(0, THUMBS).map(e => {
    const ex = EXIDX[e.id]
    return ex?.img ? imgSrc(ex, figure) : null
  })
}

/**
 * The month `y`/`m` (0-based) for the calendar (MonthGrid): `{ title, offset, weekdays, today,
 * days: [{ day, iso, value, label, workouts }] }`. A trained day has a full ring and its count in
 * its spoken label ("Mon 12 Oct, 1 workout"); every day has an `iso`, since any other day plans a
 * session. `today` is the day number when the month is this one.
 */
export function monthOf(S, y, m, today) {
  const ws = weekStartOf(S)
  const count = {}
  for (const w of S.workouts || []) {
    const day = dayOf(w)
    if (day) count[day] = (count[day] || 0) + 1
  }
  const n = new Date(y, m + 1, 0).getDate()
  const days = Array.from({ length: n }, (_, i) => {
    const iso = isoOf(new Date(y, m, i + 1))
    const k = count[iso] || 0
    const date = fmtDate(iso, true)
    return { day: i + 1, iso, workouts: k, value: k ? 1 : null, label: k ? t('{0}, {1}', date, tn('{0} workout', '{0} workouts', k)) : date }
  })
  const locale = dateLocale()
  // A Sunday in January 2023 (the 1st), so `+ d` is that weekday: the letters in the UI language.
  const weekdays = weekOrder(ws).map(d => new Date(2023, 0, 1 + d).toLocaleDateString(locale, { weekday: 'narrow' }))
  const title = new Date(y, m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const thisMonth = today.slice(0, 7) === isoOf(new Date(y, m, 1)).slice(0, 7)
  return { title, offset: weekDayOffset(new Date(y, m, 1).getDay(), ws), weekdays, days, today: thisMonth ? Number(today.slice(8, 10)) : undefined }
}

/**
 * The activities History would list beside the workouts (All / Workouts / Activities). There is
 * no source to read them from yet — Health Connect is written to, never read (owner question 5)
 * — so this is empty and the switch stays hidden until it is not.
 */
export const activitiesOf = () => []

const listOf = items => {
  try { return new Intl.ListFormat(dateLocale(), { style: 'long', type: 'conjunction' }).format(items) }
  catch { return items.join(', ') }
}
/**
 * "Chest, Shoulders and Triceps did most of the work.": the three muscles the workout loaded
 * most, by the same load the muscle map shades. Null when it loaded none (only cardio, or nothing
 * logged), and the drawer then leaves the map out.
 */
export function muscleSentence(w) {
  const top = rankOf(loadOfWorkouts([w])).worked.slice(0, 3)
  return top.length ? t('{0} did most of the work.', listOf(top.map(m => t(MUSCLE_NAME[m])))) : null
}
