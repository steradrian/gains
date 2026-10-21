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
import { isoOf, todayISO, weekKey, weekStartOf } from './format.js'

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

/**
 * The week key a check-in made on `iso` files under: the first day of that week. On the week's
 * first day itself it is the week just ended (owner decision, review #25): "How did this week
 * go?" asked on a Monday is about the week that just finished, not one that has not happened.
 */
export function checkInWeek(S, iso = todayISO()) {
  const ws = weekStartOf(S)
  const key = weekKey(iso, ws)
  if (key !== iso) return key
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return weekKey(isoOf(d), ws)
}

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

// Read, and when (review #4). A check-in counts as read only once the review that actually
// carried it is applied or dismissed: requestReview files what it sent as
//
//   S.coach.checkInSent = { jobId, week, ts }   (ts: the entry's _ts; null when it sent none)
//
// and deciding the proposal of that job (its id is the job's id on all three paths) moves
// S.coach.checkInReadTs up to `ts`. A scheduled review, which never carries one, or a check-in
// saved while a review was running, stays unread. `coach` is synced whole (sync-merge has no
// merge of its own for it), so both fields ride along with it. A state written before this has
// no checkInReadTs; it reads from the last decided review, as it used to.
const readTsOf = coach => {
  if (!isMap(coach)) return 0
  return Number.isFinite(coach.checkInReadTs) ? coach.checkInReadTs : (Number(coach.lastReview?.at) || 0)
}

/**
 * The latest check-in the Coach has not read yet, as `{ checkIn, ts }`: `checkIn` is what the
 * review payload takes, `{ week, feel?, sleep?, note? }` (only what was answered), and `ts` the
 * entry's stamp, which stays on the device. Null when every check-in has been read. Of several
 * unread weeks, the latest week wins.
 */
export function unreadCheckIn(S) {
  if (!isMap(S?.coachCheckIns)) return null
  const readAt = readTsOf(S.coach)
  let best = null
  for (const [week, e] of Object.entries(S.coachCheckIns)) {
    const answer = answerOf(e)
    if (!answer || !(Number(e._ts) > readAt) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) continue
    if (!best || week > best.week) best = { week, ts: Number(e._ts), ...answer }
  }
  if (!best) return null
  const { week, ts, feel, sleep, note } = best
  return { checkIn: { week, ...(feel && { feel }), ...(sleep && { sleep }), ...(note && { note }) }, ts }
}

/** The payload part of unreadCheckIn, or null. */
export const pendingCheckIn = S => unreadCheckIn(S)?.checkIn || null

/**
 * On a store draft, after the review job `jobId` was started: files which check-in it carried
 * (`sent`, unreadCheckIn's answer, or null for none).
 */
export function markCheckInSent(s, jobId, sent) {
  if (!isMap(s.coach) || !jobId) return
  s.coach.checkInSent = { jobId: String(jobId), week: sent?.checkIn?.week || null, ts: sent ? sent.ts : null }
}

/**
 * On a store draft, when the review proposal `proposalId` is applied or dismissed: the check-in
 * that job carried, if any, is read from now on. Call it before lastReview moves, so a state
 * written before checkInReadTs keeps the read mark it had.
 */
export function markCheckInRead(s, proposalId) {
  if (!isMap(s.coach)) return
  const sent = isMap(s.coach.checkInSent) && proposalId != null && s.coach.checkInSent.jobId === String(proposalId)
    ? s.coach.checkInSent : null
  s.coach.checkInReadTs = Math.max(readTsOf(s.coach), Number(sent?.ts) || 0)
  if (sent) s.coach.checkInSent = null
}
