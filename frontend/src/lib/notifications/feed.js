// The notifications inbox (PR07 N1, decision 1): a feed worked out on the device from what the app
// already holds. There is no server feed and nothing is stored but the read state
// (read-state.js) and this phone's reminder log (reminder-log.js). Kept FEED_DAYS.
//
// An item: { id, kind, at, title, body, target }, newest first.
//   id      kind + its source's key, so a read survives every recompute: `best:<exercise>:<workout>`,
//           `coach:<proposal id>:<change id>`, `streak:<week start>`, `recap:<week start>`, `milestone:<count>`, `reminder:<kind>:<date>`.
//   at      ms; when it happened (a workout's end, a week's last moment, a reminder's time).
//   target  where a tap goes: { route } (a full path), { day, changed? } (the day page under the
//           tab you are on, targetPath), or { week } (an ISO week, `2026-W42`). `changed` is the
//           "what changed" line of a target that is gone (PR07Edges, A target that is gone).
//
// Kinds, each only where its source is real (lesson 6: a line the data cannot back is left out):
//   best       a new best estimated 1RM from a logged workout, with the four-week rise when there
//              is a best from four weeks before to rise from. Never a first session of an
//              exercise: a best needs an earlier session to beat.
//   streak     weeks on plan, at each week's end from two in a row, with the best run so far. A
//              week whose plan cannot be proven to be today's (planKnown) breaks the run.
//   recap      each finished week: workouts done of planned (the done count alone when the plan
//              cannot be proven, planKnown), days on target (only with nutrition that can say so
//              for all seven days), weight change (only with two weigh-ins).
//   reminder   the reminders that went off on this phone (reminder-log.js), passed in.
//   milestone  workout counts: 10, 25, 50, 100, then every 50 to 500 and every 250 after.
//   coach      the weekday and routine edits the Coach applied (a weekday set to a routine or to
//              rest, a routine added, removed or renamed, a new plan), one item per stamp in
//              `S.coach.planChanges` (lib/coach-plan-changes.js), written when the change was
//              applied. The names are the stamp's own, so a line outlives a later rename or
//              delete. An older change has no stamp and no item; an undone one (reverted) none.
//              Nothing re-dates a day for the Coach, so there is no "moved to Mon 19 Oct" line.
import { dateLocale, getVersion, t, tn } from '../i18n-core.js'
import { EXIDX } from '../exercises.js'
import { cleanPlanChange } from '../coach-plan-changes.js'
import { DAYN, exerciseNameText, fmtDate, fmtDateRange, fmtNum, isoOf, startOfWeek, SUNDAY, weekStartOf } from '../format.js'
import { workoutAt, workoutDay } from '../history.js'
import { NUDGE_COPY, lineIndex } from '../nudge.js'
import { e1rmSeries, formulaOf } from '../onerm.js'
import { queueOf, weekTally } from '../queue.js'

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
    points.forEach((p, i) => {
      // Only a session before this one counts: a first log, or two logged at the same moment, has
      // nothing earlier to beat.
      const earlier = points.slice(0, i).filter(q => q.t < p.t)
      if (!earlier.length || p.y <= Math.max(...earlier.map(q => q.y))) return
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

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Whether the plan weekTally reads, which is today's (`S.week`, the queue, the routines that still
 * exist), is provably the one the week from `wk` to `end` had. Nothing is snapshotted, so it is
 * proven only by the edit stamps (lib/sync-merge.js `edited`, `deleted`): no plan day, queue, week
 * start or routine removal since the week began, and every planned weekday stamped before it (a
 * weekday with no stamp was set before stamps existed, at a time nobody knows). A coach queue that
 * reaches into the week never is: its done count is the whole pass, not that week's.
 */
export function planKnown(S, wk, end) {
  const from = new Date(wk + 'T00:00:00').getTime()
  const ed = isMap(S.edited) ? S.edited : {}
  const after = at => Number(at) >= from
  const q = queueOf(S)
  if (q && end >= q.startsOn) return false
  if (after(ed.queue) || after(ed.weekStart)) return false
  if (Object.entries(ed).some(([k, at]) => k.startsWith('week.') && after(at))) return false
  if (Object.values(isMap(S.deleted?.routines) ? S.deleted.routines : {}).some(after)) return false
  return Object.entries(isMap(S.week) ? S.week : {})
    .every(([day, ids]) => ![].concat(ids || []).length || Number(ed['week.' + day]) > 0)
}

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
    // A plan that changed since (or may have) has no "of y" to hold the week to, and no claim to
    // the streak: the week counts its workouts and breaks the run.
    const known = planKnown(S, wk, end)
    const tally = known ? weekTally(S, end) : { done: (S.workouts || []).filter(w => w?.d >= wk && w.d <= end).length, planned: 0 }
    run = known && onPlan(tally) ? run + 1 : 0
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
    return [{ id: `reminder:workout:${e.iso}`, kind: 'reminder', at: e.at, title: t('Workout today: {0}', label), body: t('Your {0} reminder.', clockOf(e)), target }]
  })
}

// The reminder's time of day in the UI language ("18:00", "6:00 PM"): the time it was set for, or,
// in an entry without one, when it went off.
function clockOf(e) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(e.time || '')
  const d = m ? new Date(`${e.iso}T${m[1].padStart(2, '0')}:${m[2]}:00`) : new Date(e.at)
  return d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
}

function coachTitle(c) {
  switch (c.type) {
    case 'week': return c.routineName ? t('Coach set {0} to {1}', t(DAYN[c.weekday]), c.routineName) : t('Coach made {0} a rest day', t(DAYN[c.weekday]))
    case 'add-routine': return t('Coach added {0}', c.routineName)
    case 'remove-routine': return t('Coach removed {0}', c.routineName)
    case 'rename-routine': return t('Coach renamed {0} to {1}', c.from, c.to)
    default: return t('Coach set up a new plan')
  }
}

function coachItems(S, from, now) {
  const stamps = Array.isArray(S.coach?.planChanges) ? S.coach.planChanges : []
  return stamps.flatMap(raw => {
    const c = cleanPlanChange(raw)
    if (!c || c.reverted || c.at < from || c.at > now) return []
    return [{ id: `coach:${c.id}`, kind: 'coach', at: c.at, title: coachTitle(c), body: t('See your plan'), target: { route: '/train/schedule' } }]
  })
}

/** Everything feedOf reads of `S` (and the UI language its lines are in), as one string: the
 *  feed is worked out again only when this changes, not on every change to the profile (the
 *  store clones the whole profile on each, so nothing is the same object twice). Worked out once
 *  per profile object, however many bells ask. */
const keys = new WeakMap()
export function feedKey(S) {
  if (!S || typeof S !== 'object') return ''
  if (!keys.has(S)) {
    const ed = isMap(S.edited) ? S.edited : {}
    const stamps = Object.entries(ed).filter(([k]) => k === 'queue' || k === 'weekStart' || k.startsWith('week.'))
    keys.set(S, JSON.stringify([
      S.workouts, S.routines, S.customEx, S.week, S.queue, S.bodyweight, S.unit, S.weekStart,
      S.oneRmFormula, S.dbLoad, stamps, S.deleted?.routines, S.coach?.planChanges,
    ]))
  }
  return getVersion() + '|' + keys.get(S)
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
    ...coachItems(S, from, now),
    ...bestItems(S, logged, from, now),
    ...weekItems(S, logged, from, now, nutrition),
    ...reminderItems(S, reminders, from, now),
    ...milestoneItems(logged, from, now),
  ]
  return items.sort((a, b) => b.at - a.at || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.id < b.id ? -1 : 1))
}

/**
 * The path a target opens under `tab` (home, train, food or me); null for one that is not a page.
 * A day opens the Day page and a week the Week page under that tab (lib/day-route.js dayPath and
 * weekPath; the pages send today, a day to come or a bad address on themselves).
 */
export function targetPath(target, tab = 'home') {
  if (!target) return null
  if (target.route) return target.route
  if (target.day) return `/${tab}/day/${target.day}`
  if (target.week) return `/${tab}/week/${target.week}`
  return null
}
