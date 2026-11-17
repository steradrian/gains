/* The body of GET /api/sync/reminder-context: what one person's stored state says about a day, in
   the terms the notifications scheduler asks (is a workout planned, already logged, excused, owed
   a nudge; is one running; is a Coach proposal waiting). Pure: the state document, the Coach record
   and the clock are handed in, nothing is read or written here. The rules are the ones the reminder
   tick in server.js applies (queue.js effectiveRoutineId, nudge.js excusedOn and nudgeFor), so the
   scheduler outside this server and the tick inside it cannot disagree about a day. */
import { effectiveRoutineId } from './queue.js';
import { excusedOn, nudgeDetail, records, toneOf } from './nudge.js';

// A running workout with no start and no set for this long is one nobody ended: not "live".
export const LIVE_STALE_MS = 12 * 3600000;

const isMap = v => v != null && typeof v === 'object' && !Array.isArray(v);
const text = v => (typeof v === 'string' ? v : null);
// An instant stored as ms or as an ISO string, in ms, or null.
const ms = v => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
// Whole seconds, UTC: `2026-10-18T16:02:11Z`.
const iso = n => new Date(n).toISOString().replace(/\.\d{3}Z$/, 'Z');

function plannedOn(S, date) {
  const rid = effectiveRoutineId(S, date);
  const routine = rid ? S.routines.find(r => r.id === rid) : null;
  if (!routine) return null;
  return { routine_id: rid, name: text(routine.name) ?? '', emoji: text(routine.emoji) || null };
}

function nudgeOn(S, date) {
  const n = nudgeDetail(S, date);
  const routine = n ? S.routines.find(r => r.id === n.routineId) : null;
  return n ? { routine_id: n.routineId, name: text(routine?.name) ?? '', missed_streak: n.missedStreak } : null;
}

// `S.workoutLive` is written by the client while a workout is on screen and nulled when it ends
// (M0). The capability is the key being there at all, so a client that never writes it keeps the
// scheduler off the live type. Stale is measured from the last thing that happened, a set or the
// start, on this server's clock.
function liveOf(S, now) {
  const w = S.workoutLive;
  if (!isMap(w) || typeof w.workoutId !== 'string' || !w.workoutId) return null;
  const startedAt = ms(w.startedAt);
  if (startedAt == null) return null;
  const lastSetAt = ms(w.lastSetAt);
  if (now - Math.max(startedAt, lastSetAt ?? 0) > LIVE_STALE_MS) return null;
  return { workout_id: w.workoutId, started_at: iso(startedAt), last_set_at: lastSetAt == null ? null : iso(lastSetAt) };
}

// The Coach record's pending proposal (coach/jobs.js), unless it has expired. Expiry is read here
// and never archived: jobs.status() would write the record, and this route reads only.
function coachOf(record, now) {
  const p = record?.pending;
  if (!isMap(p) || typeof p.id !== 'string' || !p.id) return null;
  const expiresAt = ms(p.expiresAt);
  if (expiresAt != null && expiresAt < now) return null;
  const createdAt = ms(p.createdAt);
  return {
    pending_id: p.id,
    changes: Array.isArray(p.changes) ? p.changes.length : 0,
    created_at: createdAt == null ? null : iso(createdAt),
    expires_at: expiresAt == null ? null : iso(expiresAt)
  };
}

/** Are scheduled Coach reviews on for this person: consent given and a cadence set (`everyWorkouts`
 *  or `weekly`), the same test coach/cadence.js applies. Whether the instance offers Coach at all is
 *  the caller's question (`coachOn`). Also on every row of GET /api/sync/users. */
export function coachCadenceOn(S) {
  const c = S?.coach;
  return isMap(c) && !!c.consent?.agreedAt && isMap(c.cadence) && !!(c.cadence.everyWorkouts || c.cadence.weekly);
}

// S.reminder as stored, for the one-time preference import: the five fields it has, nothing else.
function legacyReminderOf(S) {
  const r = S.reminder;
  if (!isMap(r)) return null;
  return { on: !!r.on, time: text(r.time), tz: text(r.tz), nudge: !!r.nudge, tone: toneOf(r) };
}

/** `S` the stored state, `date` the person's local YYYY-MM-DD, `coachRecord` the Coach record
 *  (`readUser(uid)` in coach/jobs.js) or undefined, `coachOn` whether the instance has Coach
 *  switched on (off: no proposal and no cadence are reported, whatever is stored), `now` ms. */
export function reminderContext(state, date, { coachRecord, coachOn = true, now = Date.now() } = {}) {
  const S = { ...state, workouts: records(state?.workouts), routines: records(state?.routines) };
  return {
    lang: text(S.lang) || 'en',
    date,
    planned: plannedOn(S, date),
    workout_logged: S.workouts.some(w => w.d === date),
    excused: excusedOn(S, date),
    nudge: nudgeOn(S, date),
    capabilities: { live: S.workoutLive !== undefined },
    live: liveOf(S, now),
    coach: coachOn ? coachOf(coachRecord, now) : null,
    coach_cadence_on: coachOn && coachCadenceOn(S),
    legacy_reminder: legacyReminderOf(S)
  };
}
