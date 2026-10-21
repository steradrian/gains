// A planned day that went by without a workout (PR02 T2.8, T2.12, T2.13; owner decision 1 of
// 2026-10-21). Train names the most recent one once, and nothing moves by itself:
//
//   - Move to today: today takes the missed routine (`S.dayPlan[today]`), and today's own session
//     goes to the next free day (`S.dayPlan[that day]`). A coach week's or rotation's session
//     needs no day: the queue floats it to the next day you train (lib/queue.js).
//   - Skip it: nothing in the plan changes; the day stays missed in History.
//
// Either way the day is marked seen, so it is offered once. Past days' logs are never touched.
//
// Seen is stored per day, the way a day note is (lib/day-notes.js):
//
//   S.missedSeen = { '2026-10-16': { seen: true, _ts }, … }
//
// Each day is its own entry with the time it was last written, merged by that stamp
// (lib/sync-merge.js STAMPED_MAPS). Taking it back (Undo) writes a stamped cleared entry
// (`{ _ts }`), not a deleted key, which would come straight back from another device's copy.
import { isoOf, todayISO } from './format.js'
import { effectiveRoutineIds, workoutDay } from './history.js'
import { dayNoteOf } from './day-notes.js'
import { queueOf } from './queue.js'

// How far back a missed day is still worth a word: the week behind today.
export const MISSED_LOOKBACK = 7
// How far ahead Move looks for a free day for today's session.
export const FREE_DAY_AHEAD = 14

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
export const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }

/** Whether the missed day `iso` has been answered (Move or Skip). */
export const seenOn = (S, iso) => isMap(S?.missedSeen) && isMap(S.missedSeen[iso]) && S.missedSeen[iso].seen === true

/** S.missedSeen with `iso` marked seen (or cleared), stamped `now`. */
export function withSeen(map, iso, seen, now = Date.now()) {
  return { ...(isMap(map) ? map : {}), [iso]: seen ? { seen: true, _ts: now } : { _ts: now } }
}

/** The day of the first workout ever logged, or null. Before it nothing counts as missed. */
export function firstWorkoutDay(S) {
  let first = null
  for (const w of S.workouts || []) { const d = workoutDay(w); if (d && (!first || d < first)) first = d }
  return first
}

// The routines a past day still owes: its plan less any coach-week or rotation session, which
// floats to the next day you train instead of being missed (queue.js: a pin on a past date is stale).
const owedIds = (S, iso, today) => {
  const q = queueOf(S)
  return effectiveRoutineIds(S, iso, today).filter(id => !(q && q.ids.includes(id)))
}
const loggedOn = (S, iso) => (S.workouts || []).some(w => workoutDay(w) === iso)

/**
 * The most recent planned day of the last MISSED_LOOKBACK that was not logged, as `{ iso, ids }`,
 * or null. Only that one: an older miss behind it is not brought up, and once it is seen (or
 * excused with a day note, or its routines are today's anyway) there is no banner. Nothing before
 * the first workout counts (the rail shows those days without marks).
 */
export function missedDay(S, today = todayISO()) {
  const first = firstWorkoutDay(S)
  if (!first) return null
  for (let i = 1; i <= MISSED_LOOKBACK; i++) {
    const iso = plusDays(today, -i)
    if (iso < first) return null
    if (loggedOn(S, iso)) continue
    const ids = owedIds(S, iso, today)
    if (!ids.length) continue
    if (seenOn(S, iso) || dayNoteOf(S, iso)) return null
    const todays = effectiveRoutineIds(S, today, today)
    return ids.every(id => todays.includes(id)) ? null : { iso, ids }
  }
  return null
}

/** The first day after `today` with nothing planned, no rest set on purpose and no note, or null. */
export function nextFreeDay(S, today = todayISO()) {
  for (let i = 1; i <= FREE_DAY_AHEAD; i++) {
    const iso = plusDays(today, i)
    if (S.dayPlan?.[iso] === undefined && !dayNoteOf(S, iso) && !effectiveRoutineIds(S, iso, today).length) return iso
  }
  return null
}

/**
 * What Move to today would do, without doing it: `{ iso, id, displaced }`. `id` is the missed
 * routine today takes (a day's override holds one routine, so a combined missed day brings its
 * first). `displaced` is today's session, `{ ids, to, floats }`, or null when today is free:
 * `to` is the day it lands on (null when no day in FREE_DAY_AHEAD is free), `floats` when it is a
 * queue session, which lands on the next day by itself and is not written anywhere.
 */
export function movePlan(S, missedIso, today = todayISO()) {
  const ids = owedIds(S, missedIso, today)
  if (!ids.length) return null
  const id = ids[0]
  const todays = effectiveRoutineIds(S, today, today).filter(x => x !== id)
  if (!todays.length) return { iso: missedIso, id, displaced: null }
  const q = queueOf(S)
  const floats = !!q && q.ids.includes(todays[0])
  return { iso: missedIso, id, displaced: { ids: todays, floats, to: floats ? plusDays(today, 1) : nextFreeDay(S, today) } }
}

// What an Undo puts back: each plan day as it was (absent stays absent) and the day's seen entry.
function snapshot(s, keys, iso) {
  const plan = Object.fromEntries(keys.map(k => [k, s.dayPlan && Object.hasOwn(s.dayPlan, k) ? { v: s.dayPlan[k] } : null]))
  const seen = isMap(s.missedSeen) && isMap(s.missedSeen[iso]) ? { ...s.missedSeen[iso] } : null
  return (t, now = Date.now()) => {
    t.dayPlan = t.dayPlan || {}
    for (const [k, was] of Object.entries(plan)) { if (was) t.dayPlan[k] = was.v; else delete t.dayPlan[k] }
    t.missedSeen = seen ? { ...(isMap(t.missedSeen) ? t.missedSeen : {}), [iso]: { ...seen } } : withSeen(t.missedSeen, iso, false, now)
  }
}

/**
 * Move to today, on a store draft (`update(s => …)`): today takes the missed routine, today's
 * session goes to its free day, the missed day is seen. Returns movePlan's answer plus
 * `undo(s, now)`, which puts every plan day it wrote and the seen entry back as they were; null
 * when the day owes nothing (it changed since the banner was drawn).
 */
export function moveToToday(s, missedIso, today = todayISO(), now = Date.now()) {
  const plan = movePlan(s, missedIso, today)
  if (!plan) return null
  const writeTo = plan.displaced && !plan.displaced.floats ? plan.displaced.to : null
  const undo = snapshot(s, [today, writeTo].filter(Boolean), missedIso)
  s.dayPlan = s.dayPlan || {}
  s.dayPlan[today] = plan.id
  if (writeTo) s.dayPlan[writeTo] = plan.displaced.ids[0]
  s.missedSeen = withSeen(s.missedSeen, missedIso, true, now)
  return { ...plan, undo }
}

/** Skip it, on a store draft: the day is seen and nothing else changes. Returns `{ iso, undo }`. */
export function skipMissed(s, missedIso, now = Date.now()) {
  const undo = snapshot(s, [], missedIso)
  s.missedSeen = withSeen(s.missedSeen, missedIso, true, now)
  return { iso: missedIso, undo }
}
