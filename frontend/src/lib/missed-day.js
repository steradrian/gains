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
//   S.missedSeen = { '2026-10-16': { seen: true, skipped?: true, _ts }, … }
//
// `skipped` is written only by Skip, so a moved day is seen without reading as skipped.
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

/** Whether the missed day `iso` was answered with Skip (not Move): only Skip writes `skipped`. */
export const skippedOn = (S, iso) => seenOn(S, iso) && S.missedSeen[iso].skipped === true

/** S.missedSeen with `iso` marked seen (or cleared), stamped `now`; `skipped` when Skip answered it. */
export function withSeen(map, iso, seen, now = Date.now(), skipped = false) {
  return { ...(isMap(map) ? map : {}), [iso]: seen ? { seen: true, ...(skipped ? { skipped: true } : {}), _ts: now } : { _ts: now } }
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
const running = S => !!S.active && !S.active.editingWorkoutId

/** The routines today has already trained: logged today, or in the session running now. */
export function trainedToday(S, today = todayISO()) {
  const ids = (S.workouts || []).filter(w => workoutDay(w) === today).flatMap(w => w.routineIds || [])
  return [...new Set([...ids, ...(running(S) ? S.active.routineIds || [] : [])])]
}

/**
 * Which of a day's routines Move or Rest actually carries: a day's override holds one routine
 * (owner default), so it is the first one `here` (the day it lands on) does not hold already, else
 * the first. Every line that names what moves reads this, so the copy and the plan agree.
 */
export const movingId = (ids, here = []) => ids.find(x => !here.includes(x)) ?? ids[0]

/**
 * The most recent planned day of the last MISSED_LOOKBACK that was not logged, as `{ iso, ids }`,
 * or null. Only that one: an older miss behind it is not brought up, and once it is seen (or
 * excused with a day note, or its routines are today's anyway, or trained today) there is no
 * banner. `ids` leaves out what today already trained. Nothing before the first workout counts
 * (the rail shows those days without marks), and nothing while a workout runs.
 */
export function missedDay(S, today = todayISO()) {
  const first = firstWorkoutDay(S)
  if (!first || running(S)) return null
  const done = trainedToday(S, today)
  for (let i = 1; i <= MISSED_LOOKBACK; i++) {
    const iso = plusDays(today, -i)
    if (iso < first) return null
    if (loggedOn(S, iso)) continue
    const owed = owedIds(S, iso, today)
    if (!owed.length) continue
    if (seenOn(S, iso) || dayNoteOf(S, iso)) return null
    const ids = owed.filter(id => !done.includes(id))
    const todays = effectiveRoutineIds(S, today, today)
    return !ids.length || ids.every(id => todays.includes(id)) ? null : { iso, ids }
  }
  return null
}

/**
 * The first day after `from` (today by default) with nothing planned, no rest set on purpose and
 * no note, or null. `today` stays the real today, which the coach queue reads its days from.
 */
export function nextFreeDay(S, today = todayISO(), from = today) {
  for (let i = 1; i <= FREE_DAY_AHEAD; i++) {
    const iso = plusDays(from, i)
    if (S.dayPlan?.[iso] === undefined && !dayNoteOf(S, iso) && !effectiveRoutineIds(S, iso, today).length) return iso
  }
  return null
}

/**
 * What Move to today would do, without doing it: `{ iso, id, displaced }`. `id` is the missed
 * routine today takes (movingId: a combined missed day brings one, the first today does not hold
 * already). `displaced` is today's session, `{ ids, id, to, floats }`, or null when today is free or
 * already trained: `id` is the one of `ids` that moves (movingId), `to` the day it lands on (null when no day in FREE_DAY_AHEAD is free),
 * `floats` when it is a queue session, which lands on the next day by itself and is not written
 * anywhere. Routines trained today (trainedToday) neither move in nor out.
 */
export function movePlan(S, missedIso, today = todayISO()) {
  const done = trainedToday(S, today)
  const ids = owedIds(S, missedIso, today).filter(x => !done.includes(x))
  if (!ids.length) return null
  const planned = effectiveRoutineIds(S, today, today)
  const id = movingId(ids, planned)
  const todays = planned.filter(x => x !== id && !done.includes(x))
  if (!todays.length) return { iso: missedIso, id, displaced: null }
  const out = movingId(todays)
  const q = queueOf(S)
  const floats = !!q && q.ids.includes(out)
  return { iso: missedIso, id, displaced: { ids: todays, id: out, floats, to: floats ? plusDays(today, 1) : nextFreeDay(S, today) } }
}

// What an Undo puts back of the plan: each day as it was (absent stays absent).
function planSnapshot(s, keys) {
  const plan = Object.fromEntries(keys.map(k => [k, s.dayPlan && Object.hasOwn(s.dayPlan, k) ? { v: s.dayPlan[k] } : null]))
  return t => {
    t.dayPlan = t.dayPlan || {}
    for (const [k, was] of Object.entries(plan)) { if (was) t.dayPlan[k] = was.v; else delete t.dayPlan[k] }
  }
}

// ...and the missed day's seen entry.
function snapshot(s, keys, iso) {
  const restorePlan = planSnapshot(s, keys)
  const seen = isMap(s.missedSeen) && isMap(s.missedSeen[iso]) ? { ...s.missedSeen[iso] } : null
  return (t, now = Date.now()) => {
    restorePlan(t)
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
  if (writeTo) s.dayPlan[writeTo] = plan.displaced.id
  s.missedSeen = withSeen(s.missedSeen, missedIso, true, now)
  return { ...plan, undo }
}

/**
 * What "Rest / skip this day" (PR02 T2.2, owner decision 1) would do to the day `iso`, today or
 * later: `{ iso, ids, id, floats, to }`, or null when the day has nothing planned. The day becomes
 * a rest day and its session moves to the next free day after it (`to`; null when none of the
 * next FREE_DAY_AHEAD is free, and the day is only rested). A day's override holds one routine, so
 * a combined day moves one, `id` (movingId). A queue session (`floats`) is not written anywhere:
 * the queue makes it the next day you train.
 */
export function restPlan(S, iso, today = todayISO()) {
  const ids = effectiveRoutineIds(S, iso, today)
  if (!ids.length) return null
  const id = movingId(ids)
  const q = queueOf(S)
  const floats = !!q && q.ids.includes(id)
  return { iso, ids, id, floats, to: floats ? null : nextFreeDay(S, today, iso) }
}

/** Rest / skip this day, on a store draft. Returns restPlan's answer plus `undo(s)`, or null. */
export function restDay(s, iso, today = todayISO()) {
  const plan = restPlan(s, iso, today)
  if (!plan) return null
  const undo = planSnapshot(s, [iso, plan.to].filter(Boolean))
  s.dayPlan = s.dayPlan || {}
  s.dayPlan[iso] = 'rest'
  if (plan.to) s.dayPlan[plan.to] = plan.id
  return { ...plan, undo }
}

/** Skip it, on a store draft: the day is seen (and marked skipped) and nothing else changes.
 *  Returns `{ iso, undo }`. */
export function skipMissed(s, missedIso, now = Date.now()) {
  const undo = snapshot(s, [], missedIso)
  s.missedSeen = withSeen(s.missedSeen, missedIso, true, now, true)
  return { iso: missedIso, undo }
}
