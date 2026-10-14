/* What the hub's data routes (sync-routes.js) read out of a profile's state and write back into it,
 * kept free of I/O so each rule can be tested on its own.
 *
 * Workouts. The state is one document with no record of when each workout changed, only the
 * revision of the whole. So the routes keep, per profile and in memory, a change log
 * (trackWorkouts): for every workout the revision at which its summary was last seen to change,
 * and for every workout that went away the revision at which it did. "Changed since revision R" is
 * then every entry of the log past R. The log only ever learns at a read, so a change made at
 * revision 9 and first read at 12 is logged at 12: still past any R the hub was given before it.
 * A log built from nothing (first read, a restart, the profile's data going back in time) starts
 * at the revision it was built at, and a hub asking from before that gets everything (`full`).
 *
 * Body weight. One value per date, in kg on the wire and in the profile's unit in the state, like
 * the app's own weigh-in (frontend lib/units.js convertBodyWeight: to 0.1 in the stored unit).
 *
 * Dates are the strings the state holds. Nothing here turns an instant into a calendar date. */
import crypto from 'node:crypto';
import { highestStamp } from './sync-stamps.js';

const LB_PER_KG = 2.2046226218;
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);
const list = v => (Array.isArray(v) ? v : []);
const round2 = v => Math.round(v * 100) / 100;
const instant = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export const unitOf = S => (S?.unit === 'lb' ? 'lb' : 'kg');
// A stored body weight in kg, to 0.01: fine enough that kg on the wire and back to lb lands on the
// same 0.1 lb it started from.
export const toKg = (w, unit) => round2(unit === 'lb' ? w / LB_PER_KG : w);
// kg from the wire as the profile stores a weigh-in: in its unit, to 0.1.
export const fromKg = (kg, unit) => Math.round((unit === 'lb' ? kg * LB_PER_KG : kg) * 10) / 10;

/** A calendar date as `YYYY-MM-DD`, and a real one (no 2026-02-30). */
export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* ------------------------------------------------------------------ workouts */

// The id a workout goes by on the wire: its own, or for one without (an import from before ids)
// the data contract's `d<date>s<start>`. One with neither has no stable name and is left out.
export function workoutId(w) {
  if (w?.id != null) return String(w.id);
  if (w?.start == null) return null;
  return `d${w.d}s${w.start}`;
}
// The same, from a key of `deleted.workouts` (sync-stamps.js workoutKey: the id, or `d|start`).
// App ids are base-36 and never hold a `|`.
const idOfKey = k => {
  const i = k.lastIndexOf('|');
  return i < 0 ? k : `d${k.slice(0, i)}s${k.slice(i + 1)}`;
};

// Done rows of a set: the set, or for a per-side set either side ticked.
const isDone = s => s.done === true ||
  (isMap(s.sides) && isMap(s.sides.L) && isMap(s.sides.R) && (s.sides.L.done === true || s.sides.R.done === true));

/**
 * A finished workout as the hub reads it: what it needs to post the session elsewhere and estimate
 * its energy, never the sets themselves. The server has no exercise library, so a cardio row is one
 * its exercise's target calls cardio, or that logged minutes without a target saying otherwise
 * (cardio sets are stored as `min` and `speed` in km/h, lib/speed.js). `content_hash` covers every
 * field but `edited_at`, so a change the hub cannot see (a note, a photo) does not count as one.
 */
export function workoutItem(w, unit) {
  const id = workoutId(w);
  if (id == null) return null;
  let done = 0, strength = 0;
  const cardio = [];
  for (const e of list(w.entries)) {
    if (!isMap(e)) continue;
    const mode = isMap(e.target) ? e.target.mode : undefined;
    for (const s of list(e.sets)) {
      if (!isMap(s) || !isDone(s)) continue;
      done++;
      const min = Number(s.min) > 0 ? Number(s.min) : 0;
      if (mode === 'cardio' || (mode !== 'reps' && mode !== 'time' && min > 0)) {
        const speed = Number(s.speed) > 0 ? Number(s.speed) : null;
        cardio.push({ min, speed_kmh: speed, km: speed && min ? round2(speed * min / 60) : null });
      } else strength++;
    }
  }
  const start = instant(w.start), end = instant(w.end);
  const bw = Number(w.bw);
  const facts = {
    id,
    date: typeof w.d === 'string' ? w.d : null,
    start, end,
    duration_min: start && end && end > start ? Math.round((end - start) / 60000) : null,
    name: typeof w.name === 'string' ? w.name : null,
    routine_id: w.routineId != null ? String(w.routineId) : null,
    sets_done: done,
    strength_sets: strength,
    cardio,
    distance_km: cardio.some(c => c.km != null) ? round2(cardio.reduce((n, c) => n + (c.km || 0), 0)) : null,
    // To 0.1, not 0.01: a unit switch converts every stored `bw` and back lands on the same 0.1 kg
    // (lib/units.js), so the hash of every workout does not move with it.
    bodyweight_kg: bw > 0 ? Math.round(toKg(bw, unit) * 10) / 10 : null
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex');
  return { ...facts, edited_at: instant(Number(w._ts)), content_hash: 'sha256:' + hash };
}

// Past this many removals on record the log starts over rather than grow: a hub asking from before
// that is given everything again, which is always correct.
const GONE_MAX = 5000;
// Which start of a log a cursor was made against (`epoch`): a log can start over at the revision it
// had, and after a restart a counter would repeat, so it is random.
const newEpoch = () => crypto.randomBytes(6).toString('hex');

/**
 * The change log of a profile's workouts, brought up to `S` (see the top of this file). `log` is
 * the previous one (or undefined); the result is it, updated, or a new one.
 * { epoch, base, rev, wid, items: Map<id, item>, seen: Map<id, {rev, hash}>, gone: Map<id, {rev, at}> }
 */
export function trackWorkouts(log, S) {
  const rev = Number(S?._rev) || 0, wid = typeof S?._wid === 'string' ? S._wid : null;
  if (log && log.rev === rev && log.wid === wid) return log;
  const unit = unitOf(S);
  const items = new Map();
  for (const w of list(S?.workouts)) {
    if (!isMap(w)) continue;
    const it = workoutItem(w, unit);
    if (it && !items.has(it.id)) items.set(it.id, it);
  }
  const removed = new Map();
  if (isMap(S?.deleted?.workouts)) {
    for (const [k, at] of Object.entries(S.deleted.workouts)) if (Number(at) > 0) removed.set(idOfKey(k), Number(at));
  }
  // Only a later revision is a continuation. The same number or a lower one with another write id
  // is the data directory gone back in time (a restored backup): start over.
  if (!log || rev <= log.rev || log.gone.size > GONE_MAX) {
    const fresh = { epoch: newEpoch(), base: rev, rev, wid, items, seen: new Map(), gone: new Map() };
    for (const [id, it] of items) fresh.seen.set(id, { rev, hash: it.content_hash });
    for (const [id, at] of removed) if (!items.has(id)) fresh.gone.set(id, { rev, at });
    return fresh;
  }
  for (const [id, it] of items) {
    const was = log.seen.get(id);
    if (!was || was.hash !== it.content_hash) log.seen.set(id, { rev, hash: it.content_hash });
    log.gone.delete(id);
  }
  for (const id of [...log.seen.keys()]) {
    if (items.has(id)) continue;
    log.seen.delete(id);
    log.gone.set(id, { rev, at: removed.get(id) ?? null });
  }
  Object.assign(log, { rev, wid, items });
  return log;
}

const encodeCursor = c => Buffer.from(JSON.stringify(c)).toString('base64url');
/** A cursor this module handed out, or null for anything else. */
export function decodeCursor(s) {
  if (typeof s !== 'string' || !s || s.length > 512 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let c;
  try { c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { return null; }
  if (!isMap(c) || !Number.isInteger(c.s) || typeof c.f !== 'boolean' || typeof c.b !== 'string' ||
      !Number.isInteger(c.r) || typeof c.k !== 'string') return null;
  return c;
}

/**
 * One page of what changed since revision `since`, in revision order (then id), from `log`:
 * workouts changed and workouts gone, each at most once per page. `full` says the pass lists every
 * workout there is (and every removal on record): `since` is absent, older than the log, newer than
 * the profile, or names a document this one does not descend from (`wid`). A cursor carries the
 * pass on; if the log started over in between, the pass starts over too, in full.
 */
export function changesSince(log, S, { since = null, wid = null, cursor = null, limit = 100 }) {
  let s, full, after = null;
  if (cursor && cursor.b === log.epoch) {
    s = cursor.s; full = cursor.f; after = cursor;
  } else if (cursor) {
    s = -1; full = true;
  } else {
    const foreign = wid != null && wid !== log.wid && !list(S?._wids).includes(wid);
    full = since == null || since < log.base || since > log.rev || foreign;
    s = full ? -1 : since;
  }
  const events = [];
  for (const [id, x] of log.seen) if (x.rev > s) events.push({ rev: x.rev, id });
  for (const [id, x] of log.gone) if (x.rev > s) events.push({ rev: x.rev, id, at: x.at });
  events.sort((a, b) => a.rev - b.rev || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rest = after ? events.filter(e => e.rev > after.r || (e.rev === after.r && e.id > after.k)) : events;
  const page = rest.slice(0, limit);
  const last = page[page.length - 1];
  return {
    full,
    items: page.filter(e => !('at' in e)).map(e => log.items.get(e.id)),
    deleted: page.filter(e => 'at' in e).map(e => ({ id: e.id, deleted_at: e.at })),
    next_cursor: rest.length > page.length ? encodeCursor({ s, f: full, b: log.epoch, r: last.rev, k: last.id }) : null
  };
}

/* ------------------------------------------------------------------ body weight */

// The weigh-in of each day as every device shows it: of several entries for one day the later `t`
// (sync-merge.js mergeBodyweight), and none where a removal on record is as late as it
// (sync-merge.js applyDeletions).
function weighIns(S) {
  const tomb = isMap(S?.deleted?.bodyweight) ? S.deleted.bodyweight : {};
  const byDay = new Map();
  for (const e of list(S?.bodyweight)) {
    if (!isMap(e) || typeof e.d !== 'string' || !(Number(e.w) > 0)) continue;
    const cur = byDay.get(e.d);
    if (!cur || (Number(e.t) || 0) > (Number(cur.t) || 0)) byDay.set(e.d, e);
  }
  for (const [d, e] of byDay) {
    const at = Number(tomb[d]) || 0;
    if (at > 0 && at >= (Number(e.t) || 0)) byDay.delete(d);
  }
  return { byDay, tomb };
}

const entryOut = (e, unit) => ({ date: e.d, kg: toKg(Number(e.w), unit), t: instant(Number(e.t)) });

/** The day's weigh-in in kg, or null. */
export function weighInOf(S, date) {
  const e = weighIns(S).byDay.get(date);
  return e ? entryOut(e, unitOf(S)) : null;
}

/** Weigh-ins and removals between `from` and `to` (inclusive, either open), by date. */
export function bodyweightView(S, { from = null, to = null } = {}) {
  const unit = unitOf(S);
  const inRange = d => (from == null || d >= from) && (to == null || d <= to);
  const { byDay, tomb } = weighIns(S);
  const items = [...byDay.values()].filter(e => inRange(e.d)).map(e => entryOut(e, unit))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const deleted = Object.entries(tomb)
    .filter(([d, at]) => Number(at) > 0 && isDate(d) && inRange(d) && !byDay.has(d))
    .map(([d, at]) => ({ date: d, deleted_at: Number(at) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return { unit, items, deleted };
}

// The `t` a write of `date` stores: later than anything the profile holds for that day and than
// every stamp of the document, so each device's merge takes it as the newest change (as the app's
// own stampChange does), and never earlier than the caller's own `t`.
function stampFor(cur, date, t, now) {
  let m = Math.max(Number(now) || 0, highestStamp(cur) + 1, Number(t) || 0);
  for (const e of list(cur?.bodyweight)) if (isMap(e) && e.d === date) m = Math.max(m, (Number(e.t) || 0) + 1);
  return Math.max(m, Math.abs(Number(cur?.deleted?.bodyweight?.[date]) || 0) + 1);
}
const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

/**
 * `cur` with `date` set to `kg`, as a new document, or null when the day already holds that value.
 * The day's other fields (anything the app keeps on a weigh-in besides `d`, `w`, `t`) are kept.
 */
export function withWeighIn(cur, date, kg, { t = null, now = Date.now() } = {}) {
  const unit = unitOf(cur);
  const w = fromKg(kg, unit);
  const old = weighIns(cur).byDay.get(date);
  if (old && Number(old.w) === w) return null;
  const next = structuredClone(cur);
  const keep = old ? structuredClone(old) : {};
  next.bodyweight = [
    ...list(next.bodyweight).filter(e => !(isMap(e) && e.d === date)),
    { ...keep, d: date, w, t: stampFor(cur, date, t, now) }
  ].sort(byDate);
  return next;
}

/** `cur` without a weigh-in on `date`, with the removal on record, or null when there is none. */
export function withoutWeighIn(cur, date, { now = Date.now() } = {}) {
  if (!weighIns(cur).byDay.has(date)) return null;
  const next = structuredClone(cur);
  const at = stampFor(cur, date, null, now);
  next.bodyweight = list(next.bodyweight).filter(e => !(isMap(e) && e.d === date));
  const del = isMap(next.deleted) ? next.deleted : (next.deleted = {});
  (isMap(del.bodyweight) ? del.bodyweight : (del.bodyweight = {}))[date] = at;
  return next;
}
