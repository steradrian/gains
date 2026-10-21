// The weekly Coach check-in (PR02 T11.1; owner question 7): how the week felt, how you slept,
// and a note. It is Coach input, not a log: it stays on the device (and in the synced copy)
// until the next review, which carries the latest one the Coach has not read (coach-api.js).
// Saving one sends nothing.
//
//   S.coachCheckIns = { '2026-10-12': { feel, sleep, note, _ts }, … }
//
// keyed by the first day of the week (format.js weekKey, under the profile's week start), each
// entry merged by its own stamp (lib/sync-merge.js STAMPED_MAPS). Undo writes a stamped cleared
// entry (`{ _ts }`), not a deleted key, which would come straight back from another device.
//
// The words and the note's length are the server's too (api/coach/core/payload.js
// CHECKIN_FEEL, CHECKIN_SLEEP, CHECKIN_NOTE_MAX; pinned by coach-parity.test.js). They are
// written out again here so the app's bundle does not pull in the payload builder.
import { todayISO, weekKey, weekStartOf } from './format.js'

export const CHECKIN_FEEL = ['easy', 'right', 'hard', 'much']
export const CHECKIN_SLEEP = ['poor', 'ok', 'good']
export const CHECKIN_NOTE_MAX = 500

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

// The answer part of an entry, or null when it holds none (a cleared entry, or junk).
function answerOf(e) {
  if (!isMap(e)) return null
  const feel = CHECKIN_FEEL.includes(e.feel) ? e.feel : null
  const sleep = CHECKIN_SLEEP.includes(e.sleep) ? e.sleep : null
  const note = typeof e.note === 'string' ? e.note.trim().slice(0, CHECKIN_NOTE_MAX) : ''
  return feel || sleep || note ? { feel, sleep, note } : null
}

/** The week key a check-in made on `iso` files under: the first day of that week. */
export const checkInWeek = (S, iso = todayISO()) => weekKey(iso, weekStartOf(S))

/** The check-in for the week `iso` falls in, as `{ feel, sleep, note }`, or null. */
export const checkInFor = (S, iso = todayISO()) =>
  answerOf(isMap(S?.coachCheckIns) ? S.coachCheckIns[checkInWeek(S, iso)] : null)

/**
 * Saves `value` ({ feel, sleep, note }; an unknown word is dropped, the note trimmed and cut to
 * CHECKIN_NOTE_MAX) as the check-in of the week `weekIso`, on a store draft. Returns
 * `undo(t, now)` for a later draft, which puts back what that week held before: the earlier
 * check-in, or a stamped clear.
 */
export function saveCheckIn(s, weekIso, value, now = Date.now()) {
  const map = isMap(s.coachCheckIns) ? s.coachCheckIns : {}
  const was = isMap(map[weekIso]) ? { ...map[weekIso] } : null
  const answer = answerOf(value) || { feel: null, sleep: null, note: '' }
  s.coachCheckIns = { ...map, [weekIso]: { ...answer, _ts: now } }
  return (t, at = Date.now()) => {
    const cur = isMap(t.coachCheckIns) ? t.coachCheckIns : {}
    t.coachCheckIns = { ...cur, [weekIso]: was ? { ...was, _ts: at } : { _ts: at } }
  }
}

/**
 * The latest check-in the Coach has not read yet, as the review payload takes it:
 * `{ week, feel?, sleep?, note? }` (only what was answered), or null. Read means saved before
 * the last review was decided (`S.coach.lastReview.at`, set when a review is applied or
 * dismissed). Of several unread weeks, the latest week wins.
 */
export function pendingCheckIn(S) {
  if (!isMap(S?.coachCheckIns)) return null
  const readAt = Number(S.coach?.lastReview?.at) || 0
  let best = null
  for (const [week, e] of Object.entries(S.coachCheckIns)) {
    const answer = answerOf(e)
    if (!answer || !(Number(e._ts) > readAt) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) continue
    if (!best || week > best.week) best = { week, ...answer }
  }
  if (!best) return null
  const { week, feel, sleep, note } = best
  return { week, ...(feel && { feel }), ...(sleep && { sleep }), ...(note && { note }) }
}
