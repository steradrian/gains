/* Friends api m2: a group's week. The ring (each member's done of planned, and the group's by its
 * goal), the high-water mark that keeps done from going back within a week, the result of every
 * finished week, and the streak read from those results.
 *
 * Who counts: active accounts with Friends on (rules.js countsIn), the same set whoever asks, so
 * every member sees one ring. A muted member still counts; someone with Friends off, or a
 * disabled account, counts for nothing while they are.
 *
 * Goals, judged on the week's numbers:
 *   planned   the sessions done by members with a plan, against the sum of their planned; a week
 *             nobody planned is neither hit nor missed
 *   number    every counting member's sessions done, against the group's number
 *   targets   every member who shares targets hit their week (targetsWeek): TARGET_DAYS days with
 *             the food targets reached in the Monday-to-Sunday week, counted absolutely (a day
 *             without data is not reached, never a share of the days known); someone who joined
 *             during the week needs ceil(TARGET_DAYS / 7 x their days in it). `targets: { hit,
 *             of }` sums each member's days reached, capped at their need, against the needs, so
 *             hit >= of exactly when everyone hit. A week nobody shares targets in is neither
 *             hit nor missed
 *
 * Reading writes, in one store.mutate and only when the client's date is plausible (the server's
 * UTC date, give or take a day, so a made-up date cannot settle weeks that have not happened):
 *   highWater[week][uid]   the most done this member was seen with in that week; done is
 *                          max(high-water, now), so deleting a workout never takes the ring back,
 *                          while planned is recomputed on every read
 *   results[week]          true, false or null (neither), written once, for each week that ended
 *                          since the group was last read (the weeks before its first read are not
 *                          judged), from the high-water marks and the members as they are then
 *   lastWeek               the newest week a read has seen
 * A write that fails changes nothing and the answer is still given.
 *
 * Streak: weeks in a row whose result is true, back from last week, the current week added once
 * it is hit. A week that is neither is skipped; a missed or unjudged one ends the run. */
import { refuse } from './refusal.js';
import { membersOf, countsIn, shareOf, isDate, weekOf, addDays } from './rules.js';
import { CONSISTENCY_WEEKS, daysOf } from './stats.js';
import { memberProjection } from './cache.js';

// Weeks that ended while nobody looked are judged from the projection's history, which reaches
// back this far; older ones go unjudged and end the streak.
export const SETTLE_WEEKS = CONSISTENCY_WEEKS;
export const RESULTS_KEEP_WEEKS = 260;
export const HIGH_WATER_KEEP_WEEKS = 9;
// Days with the food targets reached that make a member's full week hit.
export const TARGET_DAYS = 5;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** The server's UTC date. */
export const serverDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** Whether `date` can be someone's today by the server's clock: the server's UTC date or the day
 *  either side of it, which covers every time zone (UTC-12 to UTC+14) and nothing more, so a
 *  Saturday client cannot read the next Monday and close the running week early. */
export function plausibleDate(date, now = Date.now()) {
  if (!isDate(date)) return false;
  const today = serverDay(now);
  return date >= addDays(today, -1) && date <= addDays(today, 1);
}

/** The client's `date` on a write. Friends never falls back to UTC for a person's dates, so a
 *  missing or implausible date is `400 bad-date`. */
export function writeDay(date, now = Date.now()) {
  if (!plausibleDate(date, now)) refuse(400, 'bad-date', 'date must be your local today, YYYY-MM-DD');
  return date;
}

/** The goal as the client words it: structured, never a sentence. */
export const goalLineOf = goal => (goal?.kind === 'number' ? { kind: 'number', n: goal.n } : { kind: goal?.kind === 'targets' ? 'targets' : 'planned' });

/** The uids counting toward the group's week, in join order. */
export const countingMembers = (data, group, active) =>
  membersOf(group).map(m => m.uid).filter(uid => countsIn(data, uid, active));

const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);

/** The local date `uid` joined `group` on: `joinedOn`, else (members from before it was kept) the
 *  date of the `joined` instant. Null when neither is there. */
export function joinedOnOf(group, uid) {
  const m = membersOf(group).find(x => x.uid === uid);
  if (isDate(m?.joinedOn)) return m.joinedOn;
  const d = typeof m?.joined === 'string' ? m.joined.slice(0, 10) : null;
  return isDate(d) ? d : null;
}

/**
 * A member's food targets in `week` as the goal counts them: `{ hit, of }`, `of` the days they
 * need (TARGET_DAYS, or ceil(TARGET_DAYS / 7 x days in the group) for a week they joined in) and
 * `hit` the days reached since they joined, capped at `of`. `targets` is the projection's week
 * (stats.js: `days`, seven of true, false or null); null when they do not share targets, and when
 * they joined after the week.
 */
export function targetsWeek(targets, week, joinedOn) {
  if (!targets || !Array.isArray(targets.days)) return null;
  const from = isDate(joinedOn) && joinedOn > week ? joinedOn : week;
  const days = daysOf(week);
  const inGroup = days.filter(d => d >= from).length;
  if (inGroup === 0) return null;
  const of = inGroup >= 7 ? TARGET_DAYS : Math.ceil((TARGET_DAYS * inGroup) / 7);
  const reached = days.filter((d, i) => d >= from && targets.days[i] === true).length;
  return { hit: Math.min(reached, of), of };
}

/** A week's totals by the goal: `rows` are `{ done, planned, noPlan, targets: { hit, of } | null }`,
 *  `targets` from targetsWeek. `hit` is true, false, or null for a week that is neither. */
export function goalOf(goal, rows) {
  const planned = sum(rows, r => r.planned);
  const targets = { hit: sum(rows, r => r.targets?.hit || 0), of: sum(rows, r => r.targets?.of || 0) };
  if (goal?.kind === 'number') {
    const done = sum(rows, r => r.done);
    return { done, planned, targets, hit: Number.isInteger(goal.n) && goal.n > 0 ? done >= goal.n : null };
  }
  if (goal?.kind === 'targets') {
    const sharing = rows.filter(r => r.targets && r.targets.of > 0);
    return { done: sum(rows, r => r.done), planned, targets, hit: sharing.length ? sharing.every(r => r.targets.hit >= r.targets.of) : null };
  }
  const done = sum(rows.filter(r => !r.noPlan), r => r.done);
  return { done, planned, targets, hit: planned > 0 ? done >= planned : null };
}

/** Weeks in a row the goal was hit, back from the week before `week`, plus `week` once it is hit. */
export function streakOf(group, week, currentHit) {
  const results = isObj(group?.results) ? group.results : {};
  let n = currentHit === true ? 1 : 0;
  let wk = addDays(week, -7);
  for (let i = 0; i < RESULTS_KEEP_WEEKS; i++, wk = addDays(wk, -7)) {
    if (!Object.hasOwn(results, wk)) break;
    if (results[wk] === true) n++;
    else if (results[wk] !== null) break;
  }
  return n;
}

const highWaterOf = (group, week, uid) => Number(isObj(group.highWater?.[week]) ? group.highWater[week][uid] : 0) || 0;

// The high-water marks of this week, the results of the weeks that ended, `lastWeek`, and the
// pruning of both maps. Idempotent: a second read with nothing new writes nothing.
function settle(store, gid, week, rows) {
  try {
    store.mutate(d => {
      const g = d.groups[gid];
      if (!isObj(g)) return;
      if (!isObj(g.highWater)) g.highWater = {};
      if (!isObj(g.results)) g.results = {};
      for (const r of rows) {
        if (r.p.done <= highWaterOf(g, week, r.uid)) continue;
        if (!isObj(g.highWater[week])) g.highWater[week] = {};
        g.highWater[week][r.uid] = r.p.done;
      }
      const last = typeof g.lastWeek === 'string' && isDate(g.lastWeek) ? g.lastWeek : null;
      if (last && last < week) {
        for (let k = SETTLE_WEEKS - 1; k >= 1; k--) {
          const wk = addDays(week, -7 * k);
          if (wk < last || Object.hasOwn(g.results, wk)) continue;
          g.results[wk] = goalOf(g.goal, rows.map(r => {
            const h = r.p.history.find(x => x.week === wk);
            const planned = h?.planned || 0;
            return { done: Math.max(h?.done || 0, highWaterOf(g, wk, r.uid)), planned, noPlan: planned === 0, targets: targetsWeek(h?.targets, wk, joinedOnOf(g, r.uid)) };
          })).hit;
        }
      }
      if (!last || last < week) g.lastWeek = week;
      const keepHw = addDays(week, -7 * HIGH_WATER_KEEP_WEEKS);
      const keepResults = addDays(week, -7 * RESULTS_KEEP_WEEKS);
      for (const k of Object.keys(g.highWater)) if (!(k >= keepHw)) delete g.highWater[k];
      for (const k of Object.keys(g.results)) if (!(k >= keepResults)) delete g.results[k];
    });
  } catch (e) {
    console.error('friends week not saved for group', gid, e.message);
  }
}

/**
 * The week of `date` for group `gid` (`group` is `data.groups[gid]`, `data` the store's document):
 * `{ week, rows: [{ uid, p, done, planned, noPlan }], totals: { done, planned, targets, hit }, streak }`.
 * `p` is the member's projection (stats.js). With a `store`, settles what the read saw (above).
 */
export function groupWeek({ data, gid, group, date, active, store = null, now = Date.now() }) {
  const week = weekOf(date);
  const rows = countingMembers(data, group, active).map(uid => {
    const p = memberProjection(uid, shareOf(data.people[uid]), date, now);
    return { uid, p, done: Math.max(p.done, highWaterOf(group, week, uid)), planned: p.planned, noPlan: p.noPlan };
  });
  if (store && plausibleDate(date, now)) {
    settle(store, gid, week, rows);
    // settle wrote into the store's document; the group read from it is that same object.
    for (const r of rows) r.done = Math.max(r.done, highWaterOf(group, week, r.uid));
  }
  const totals = goalOf(group.goal, rows.map(r => ({
    done: r.done, planned: r.planned, noPlan: r.noPlan, targets: targetsWeek(r.p.history.at(-1)?.targets, week, joinedOnOf(group, r.uid))
  })));
  return { week, rows, totals, streak: streakOf(group, week, totals.hit) };
}
