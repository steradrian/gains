// The notifications inbox (PR07 N1, decision 1): a feed worked out on the device from what the app
// already holds. There is no server feed and nothing is stored but the read state
// (read-state.js) and this phone's reminder log (reminder-log.js). Kept FEED_DAYS.
//
// An item: { id, kind, at, title, body, target }, newest first.
//   id      kind + its source's key, so a read survives every recompute: `best:<exercise>:<workout>`,
//           `streak:<week start>`, `recap:<week start>`, `milestone:<count>`, `reminder:<kind>:<date>`.
//   at      ms; when it happened (a workout's end, a week's last moment, a reminder's time).
//   target  where a tap goes: { route } (a full path), { day, changed? } (the day page under the
//           tab you are on, targetPath), or { week } (an ISO week, `2026-W42`). `changed` is the
//           "what changed" line of a target that is gone (PR07Edges, A target that is gone).
//
// Kinds, each only where its source is real (lesson 6: a line the data cannot back is left out):
//   best       a new best estimated 1RM from a logged workout, with the four-week rise when there
//              is a best from four weeks before to rise from.
//   streak     weeks on plan, at each week's end from two in a row, with the best run so far.
//   recap      each finished week: workouts done of planned, days on target (only with nutrition
//              that can say so for all seven days), weight change (only with two weigh-ins).
//   reminder   the reminders that went off on this phone (reminder-log.js), passed in.
//   milestone  workout counts: 10, 25, 50, 100, then every 50 to 500 and every 250 after.
// Not here: `coach`. A day override (`S.dayPlan`) records no author, so a day Coach moved cannot be
// told from one you moved; it stays out until overrides say who made them.
import { t, tn } from '../i18n-core.js'
import { EXIDX } from '../exercises.js'
import { exerciseNameText, fmtDate, fmtDateRange, fmtNum, isoOf, startOfWeek, SUNDAY, weekStartOf } from '../format.js'
import { workoutAt, workoutDay } from '../history.js'
import { NUDGE_COPY, lineIndex } from '../nudge.js'
import { e1rmSeries, formulaOf } from '../onerm.js'
import { weekTally } from '../queue.js'

export const FEED_DAYS = 30
const DAY_MS = 86400000
const FOUR_WEEKS_MS = 28 * DAY_MS
// The order of items that share a moment: a week's streak before its recap.
const KIND_ORDER = ['coach', 'best', 'streak', 'recap', 'reminder', 'milestone']

export const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
// The last moment of a local day.
const endOfDay = iso => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getTime() - 1 }

/** The ISO week (`2026-W42`) of the week starting `weekStart`: a Sunday-first week is named by
 *  the Monday inside it, so both week starts give the same key to the Day and Week pages. */
export function isoWeekOf(weekStart, ws) {
  const monday = ws === SUNDAY ? plusDays(weekStart, 1) : weekStart
  const thursday = new Date(plusDays(monday, 3) + 'T12:00:00')
  const year = thursday.getFullYear()
  const dayOfYear = Math.round((Date.UTC(year, thursday.getMonth(), thursday.getDate()) - Date.UTC(year, 0, 1)) / DAY_MS) + 1
  return year + '-W' + String(Math.ceil(dayOfYear / 7)).padStart(2, '0')
}

const workoutKey = w => (w?.id != null ? String(w.id) : `${w?.d}|${w?.start}`)
// When a workout was done: its end, else its start, else noon of its day.
const doneAt = w => (Number.isFinite(w?.end) ? w.end : workoutAt(w))
const weight = (n, S) => fmtNum(n) + ' ' + (S.unit || 'kg')
const signed = (n, S) => {
  const r = Math.round(n * 10) / 10
  return (r > 0 ? '+' : r < 0 ? '−' : '') + weight(Math.abs(r), S)
}
const exerciseOf = (S, id) => (S.customEx || []).find(e => e?.id === id) || EXIDX[id] || null

/** The workouts with a day, in the order they were done. */
const loggedOf = S => (S.workouts || [])
  .filter(w => workoutDay(w) && Number.isFinite(doneAt(w)))
  .sort((a, b) => doneAt(a) - doneAt(b))

function bestItems(S, logged, from, now) {
  const items = []
  const formula = formulaOf(S)
  const recent = logged.filter(w => doneAt(w) >= from && doneAt(w) <= now)
  const exIds = new Set(recent.flatMap(w => (Array.isArray(w.entries) ? w.entries : []).map(e => e?.id).filter(Boolean)))
  for (const exId of exIds) {
    const points = e1rmSeries(S, exId, formula).filter(p => Number.isFinite(p.t)).sort((a, b) => a.t - b.t)
    let before = null
    points.forEach((p, i) => {
      const prev = before
      before = before == null ? p.y : Math.max(before, p.y)
      if (prev == null || p.y <= prev) return
      // The point's workout: e1rmSeries keys a point by the workout's start and day.
      const w = recent.find(x => workoutAt(x) === p.t && x.d === p.d && (x.entries || []).some(e => e?.id === exId))
      if (!w) return
      const old = points.slice(0, i).filter(q => q.t <= p.t - FOUR_WEEKS_MS)
      const base = old.length ? Math.max(...old.map(q => q.y)) : null
      const ex = exerciseOf(S, exId)
      const day = workoutDay(w)
      items.push({
        id: `best:${exId}:${workoutKey(w)}`,
        kind: 'best',
        at: doneAt(w),
        title: t('New best: {0}', ex ? exerciseNameText(ex) : t('Unknown exercise')),
        body: base != null && p.y > base
          ? t('Est. 1RM {0}, up {1} in four weeks.', weight(p.y, S), weight(p.y - base, S))
          : t('Est. 1RM {0}.', weight(p.y, S)),
        target: ex ? { route: '/progress/strength?ex=' + encodeURIComponent(exId) } : { day, changed: t('This exercise was deleted.') },
      })
    })
  }
  return items
}

/** Whether a finished week was on plan: every planned workout done (weekTally, Today's count), or
 *  for a week with nothing planned, any workout at all. */
const onPlan = ({ done, planned }) => (planned > 0 ? done >= planned : done > 0)

function weekItems(S, logged, from, now, nutrition) {
  if (!logged.length) return []
  const items = []
  const ws = weekStartOf(S)
  const first = logged.map(workoutDay).sort()[0]
  const current = isoOf(startOfWeek(isoOf(new Date(now)), ws))
  const weighIns = (S.bodyweight || []).filter(b => b && typeof b.d === 'string' && Number.isFinite(Number(b.w)))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  let run = 0, best = 0
  for (let wk = isoOf(startOfWeek(first, ws)); wk < current; wk = plusDays(wk, 7)) {
    const end = plusDays(wk, 6)
    const tally = weekTally(S, end)
    run = onPlan(tally) ? run + 1 : 0
    best = Math.max(best, run)
    const at = endOfDay(end)
    if (at < from || at > now) continue
    const week = isoWeekOf(wk, ws)
    if (run >= 2) {
      items.push({
        id: `streak:${wk}`,
        kind: 'streak',
        at,
        title: tn('{0} week on plan', '{0} weeks on plan', run),
        body: run >= best
          ? t('Every planned workout done or moved. Your best run yet.')
          : t('Every planned workout done or moved. Your best is {0}.', best),
        target: { week },
      })
    }
    if (tally.done || tally.planned) {
      const parts = [tally.planned > 0 ? t('{0} of {1} workouts', tally.done, tally.planned) : tn('{0} workout', '{0} workouts', tally.done)]
      const days = Array.from({ length: 7 }, (_, i) => plusDays(wk, i))
      const onTarget = nutrition?.dayOnTarget ? days.map(d => nutrition.dayOnTarget(d)) : null
      if (onTarget && onTarget.every(v => v === true || v === false)) {
        parts.push(t('{0} of 7 days on target', onTarget.filter(Boolean).length))
      }
      const inWeek = weighIns.filter(b => b.d >= wk && b.d <= end)
      if (inWeek.length >= 2) parts.push(signed(Number(inWeek.at(-1).w) - Number(inWeek[0].w), S))
      items.push({
        id: `recap:${wk}`,
        kind: 'recap',
        at,
        title: t('Your week, {0}', fmtDateRange(wk, end, false, new Date(now))),
        body: parts.join(' · '),
        target: { week },
      })
    }
  }
  return items
}

/** The workout counts that earn a milestone, up to `n`. */
export function milestonesUpTo(n) {
  const out = [10, 25, 50, 100]
  for (let m = 150; m <= Math.min(n, 500); m += 50) out.push(m)
  for (let m = 750; m <= n; m += 250) out.push(m)
  return out.filter(m => m <= n)
}

function milestoneItems(logged, from, now) {
  if (!logged.length) return []
  const byDay = [...logged].sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : workoutDay(a) > workoutDay(b) ? 1 : doneAt(a) - doneAt(b)))
  const first = workoutDay(byDay[0])
  return milestonesUpTo(byDay.length).flatMap(n => {
    const w = byDay[n - 1]
    const at = doneAt(w)
    if (at < from || at > now) return []
    return [{
      id: `milestone:${n}`,
      kind: 'milestone',
      at,
      title: tn('{0} workout', '{0} workouts', n),
      body: t('Since you started on {0}.', fmtDate(first)),
      target: { day: workoutDay(w) },
    }]
  })
}

const labelOf = names => (names.length <= 2 ? names.join(' + ') : tn('{0} routine', '{0} routines', names.length))

function reminderItems(S, reminders, from, now) {
  const routines = Array.isArray(S.routines) ? S.routines : []
  return (reminders || []).flatMap(e => {
    if (!e || !Number.isFinite(e.at) || e.at < from || e.at > now) return []
    const planned = Array.isArray(e.routines) ? e.routines.filter(r => r && r.id) : []
    if (!planned.length) return []
    const label = labelOf(planned.map(r => routines.find(x => x.id === r.id)?.name || r.name))
    const gone = planned.filter(r => !routines.some(x => x.id === r.id))
    const target = gone.length ? { day: e.iso, changed: t('{0} was deleted.', labelOf(gone.map(r => r.name))) } : { day: e.iso }
    if (e.kind === 'nudge') {
      const copy = NUDGE_COPY[e.tone] || NUDGE_COPY.friendly
      return [{ id: `reminder:nudge:${e.iso}`, kind: 'reminder', at: e.at, title: t(copy.title), body: t(copy.lines[lineIndex(e.iso, copy.lines.length)], label), target }]
    }
    if (e.kind !== 'workout') return []
    return [{ id: `reminder:workout:${e.iso}`, kind: 'reminder', at: e.at, title: t('Workout today: {0}', label), body: t('Your {0} reminder.', e.time || ''), target }]
  })
}

/**
 * The feed as of `now`: every item of the last FEED_DAYS, newest first.
 * `nutrition`: null, or { dayOnTarget(iso) → true | false | null } (null: not known for that day).
 * `reminders`: the reminders that went off on this device (reminder-log.js firedReminders).
 */
export function feedOf(S, { now = Date.now(), nutrition = null, reminders = [] } = {}) {
  const from = now - FEED_DAYS * DAY_MS
  const logged = loggedOf(S)
  const items = [
    ...bestItems(S, logged, from, now),
    ...weekItems(S, logged, from, now, nutrition),
    ...reminderItems(S, reminders, from, now),
    ...milestoneItems(logged, from, now),
  ]
  return items.sort((a, b) => b.at - a.at || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.id < b.id ? -1 : 1))
}

/** The path a target opens under `tab` (home, train, food or me); null for one that is not a page. */
export function targetPath(target, tab = 'home') {
  if (!target) return null
  if (target.route) return target.route
  if (target.day) return `/${tab}/day/${target.day}`
  if (target.week) return `/${tab}/week/${target.week}`
  return null
}
