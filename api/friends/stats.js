/* Friends api m2: the share projection, the privacy boundary between one person's synced state and
 * everyone else in their groups.
 *
 * Pure: a state document, that person's four share switches and the client's date go in, plain
 * data comes out; nothing is read or written here. Every object that leaves is built key by key
 * from the allow-list below. Nothing of the state is spread or passed through, so no field the
 * state holds (weights, body weight, foods, intake, photos, notes, sets) or gains later can ride
 * along.
 *
 * What may leave, and when:
 *   always        how many workouts are dated in a week and how many days were planned: the ring
 *   training      which workout (its name), its date, its minutes, how many exercises; which days
 *   consistency   the share of planned sessions done, week by week, for 8 weeks
 *   targets       whether a day's targets were reached, from S.targetsReached (the client writes
 *                 it; the server never judges a food target); a day missing there is unknown
 *   bests         the catalogue exercise of a new best (`workout.prs`) and its date, never the set
 * A workout marked `share.off` ("Don't share this one") still counts as a session and shows as
 * nothing else, not even a best. `share.best` names exercises of that workout whose new best is
 * shared with the bests switch off. `share.together: false` keeps that workout out of every
 * Trained together moment (moments.js); it still shows as its own workout.
 *
 * Planned is the schedule as it is now, re-read on every call, as the app's own week line counts
 * it (frontend lib/queue.js weekTally): each weekday with a routine that still exists, plus the
 * sessions of a planner's queue once it has started. The state keeps no history of the plan, so a
 * past week is held to today's plan.
 *
 * Dates are the stored `YYYY-MM-DD` strings; nothing here turns an instant into a date. */
import crypto from 'node:crypto';
import { libraryHas, libraryName } from '../coach/core/library.js';
import { cleanText, isDate, weekOf, addDays } from './rules.js';

export const CONSISTENCY_WEEKS = 8;
export const MOMENT_DAYS = 7;
export const RECENT_MAX = 5;
export const BESTS_MAX = 5;
export const BESTS_DAYS = 28;
export const TITLE_MAX = 60;
// A protein moment once the target was reached on this many days of the week (the boards' "5 of 7").
export const TARGET_MOMENT_DAYS = 5;
const MINUTES_MAX = 24 * 60;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const records = v => (Array.isArray(v) ? v.filter(isObj) : []);
const newestFirst = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (Number(b.start) || 0) - (Number(a.start) || 0));

/** A short opaque name for something of the person's own (a workout id, a routine): enough to tell
 *  two apart in a moment id, nothing to read back. */
export const refOf = s => crypto.createHash('sha256').update(String(s)).digest('base64url').slice(0, 12);

/** The seven dates of the week starting `monday`. */
export const daysOf = monday => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** The share switches as booleans, whatever was handed in. */
const switches = share => ({
  training: share?.training === true,
  consistency: share?.consistency === true,
  targets: share?.targets === true,
  bests: share?.bests === true
});

function workoutShare(w) {
  const s = isObj(w.share) ? w.share : {};
  return { off: s.off === true, best: Array.isArray(s.best) ? s.best.filter(x => typeof x === 'string') : [], together: s.together !== false };
}
const titleOf = w => cleanText(w.name, TITLE_MAX);
function minutesOf(w) {
  const a = Number(w.start), b = Number(w.end);
  if (!(a > 0) || !(b > a)) return null;
  const m = Math.round((b - a) / 60000);
  return m <= MINUTES_MAX ? m : null;
}
// The instant the workout ended (or started), as stored, for ordering moments within a day.
function atOf(w) {
  const t = Number(w.end) > 0 ? Number(w.end) : Number(w.start);
  if (!(t > 0)) return null;
  const at = new Date(t);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
// Two members trained together when their workouts share a routine name (or, unnamed, an id).
function togetherOf(w) {
  const name = cleanText(w.name, TITLE_MAX).toLocaleLowerCase();
  if (name) return refOf('n:' + name);
  const id = Array.isArray(w.routineIds) && w.routineIds.length ? w.routineIds[0] : w.routineId;
  return typeof id === 'string' && id ? refOf('i:' + id) : null;
}

/** Days planned in a week, by the schedule as it stands, the queue counted from `asOf` on. */
export function plannedAsOf(S, asOf) {
  const ids = new Set(records(S?.routines).map(r => r.id).filter(id => id != null));
  const q = isObj(S?.queue) && Array.isArray(S.queue.ids) ? S.queue : null;
  const started = !!q && (typeof q.startsOn !== 'string' || q.startsOn <= asOf);
  const queued = started ? [...new Set(q.ids.filter(id => ids.has(id)))] : [];
  const covered = queued.length ? q.ids : [];
  const week = S?.week && typeof S.week === 'object' ? S.week : {};
  let own = 0;
  for (let wd = 0; wd < 7; wd++) {
    if ([].concat(week[wd] ?? []).some(id => ids.has(id) && !covered.includes(id))) own++;
  }
  return own + queued.length;
}

function targetOn(S, day) {
  const map = isObj(S?.targetsReached) ? S.targetsReached : null;
  return map && Object.hasOwn(map, day) && isObj(map[day]) ? map[day] : null;
}
const flag = (v, k) => (v && typeof v[k] === 'boolean' ? v[k] : null);

/** A week's targets: each day reached, missed or unknown (null; later than `asOf` is unknown). */
function targetsIn(S, monday, asOf) {
  const days = daysOf(monday).map(d => (d > asOf ? null : flag(targetOn(S, d), 'all')));
  return { hit: days.filter(x => x === true).length, of: days.filter(x => x !== null).length, days };
}

/**
 * What `S` shows of its owner on `date`, by `share`. Internal keys (`history`, `workouts`,
 * `dayCounts`, `protein`, `bestMoments`) feed the group's ring and moments; the answers are built
 * from them field by field (group-view.js). Keys absent mean not shared.
 *
 *   done, planned, noPlan            the week of `date`
 *   history: [{ week, done, planned, targets: { hit, of, days } | null }]   8 weeks, oldest first
 *   days, dayCounts, recent, workouts                                       training only
 *   consistency                                                             consistency only
 *   targets, protein                                                        targets only
 *   bests, bestMoments                                                      bests shared
 */
export function memberWeek(S, share, date) {
  const sh = switches(share);
  const week = weekOf(date);
  const end = addDays(week, 6);
  const all = records(S?.workouts).filter(w => isDate(w.d));
  const between = (a, b) => all.filter(w => w.d >= a && w.d <= b);
  const planned = plannedAsOf(S, date);
  const out = { done: between(week, end).length, planned, noPlan: planned === 0 };

  out.history = [];
  for (let k = CONSISTENCY_WEEKS - 1; k >= 0; k--) {
    const wk = addDays(week, -7 * k), we = addDays(wk, 6);
    const asOf = k === 0 ? date : we;
    out.history.push({
      week: wk,
      done: between(wk, we).length,
      planned: k === 0 ? planned : plannedAsOf(S, asOf),
      targets: sh.targets ? targetsIn(S, wk, asOf) : null
    });
  }
  if (sh.consistency) {
    out.consistency = out.history.map(h => ({
      week: h.week,
      share: h.planned > 0 ? Math.round(Math.min(1, h.done / h.planned) * 100) / 100 : null
    }));
  }

  const from = addDays(date, -(MOMENT_DAYS - 1));
  if (sh.training) {
    const shown = all.filter(w => !workoutShare(w).off);
    const days = daysOf(week);
    out.dayCounts = days.map(d => shown.filter(w => w.d === d).length);
    out.days = out.dayCounts.map(n => n > 0);
    out.recent = shown.filter(w => w.d <= date).sort(newestFirst).slice(0, RECENT_MAX)
      .map(w => ({ title: titleOf(w), date: w.d, minutes: minutesOf(w) }));
    out.workouts = shown.filter(w => w.d >= from && w.d <= date).sort(newestFirst).map(w => ({
      ref: refOf(w.id ?? `${w.d}|${w.start}`),
      date: w.d,
      title: titleOf(w),
      minutes: minutesOf(w),
      exercises: records(w.entries).length,
      at: atOf(w),
      together: togetherOf(w),
      ...(workoutShare(w).together ? {} : { togetherOff: true })
    }));
  }

  if (sh.targets) {
    const t = targetsIn(S, week, date);
    out.targets = { reached: t.hit, of: t.of, days: t.days };
    let n = 0, reachedOn = null;
    for (const d of daysOf(week)) {
      if (d > date) break;
      if (flag(targetOn(S, d), 'protein') === true && ++n === TARGET_MOMENT_DAYS) reachedOn = d;
    }
    out.protein = { week, days: n, reachedOn };
  }

  const since = addDays(date, -(BESTS_DAYS - 1));
  const found = [];
  let perItem = false;
  for (const w of all) {
    const ws = workoutShare(w);
    if (ws.off || w.d > date || w.d < since) continue;
    for (const id of Array.isArray(w.prs) ? w.prs : []) {
      if (typeof id !== 'string' || !libraryHas(id)) continue;
      const item = ws.best.includes(id);
      if (!sh.bests && !item) continue;
      perItem ||= item;
      found.push({ id, date: w.d, start: Number(w.start) || 0 });
    }
  }
  if (sh.bests || perItem) {
    found.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.start - a.start));
    const seen = new Set();
    const bests = [];
    for (const b of found) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      bests.push({ id: b.id, exercise: libraryName(b.id), date: b.date });
    }
    out.bests = bests.slice(0, BESTS_MAX);
    out.bestMoments = bests.filter(b => b.date >= from).map(b => ({ id: b.id, exercise: b.exercise, date: b.date }));
  }
  return out;
}
