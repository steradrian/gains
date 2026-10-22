/* Friends api m3: group challenges, computed on read.
 *
 * A stored challenge is `{ id, group, template, span, start, end, creator, created, joined:
 * [{ uid, at }], hitAt? }`. Its numbers are never stored: every read counts each joined person's
 * own state between `start` and `end` (challenge-facts.js, allow-listed counts only, memoised for a
 * minute in cache.js). Leaving takes a person out of `joined`, which is all it takes to take their
 * work off the bar.
 *
 * Counting, per person, capped at `perPerson` (bar goal = perPerson x people in):
 *   workouts   finished workouts in the span; perPerson 3 for each week of the span
 *   protein    days the protein target was reached (S.targetsReached[day].protein); 5 per week
 *   weekend    Saturdays and Sundays with at least one workout, one per day; 2 per week
 *   bests      different exercises with a new best, shared or not, only the number; 1, whatever the span
 * Spans run from the Monday of the week the client's date is in: week 7 days, twoWeeks 14, month 28.
 *
 * State: done once total >= goal (sticky: `hitAt` is written by a read that saw it, so a later
 * leave does not take it back), missed once the client's date is past `end` and it was not hit,
 * active otherwise. Only visible members (rules.js visibleMember: an active account with Friends
 * on, and the viewer) appear in joined and invited, and only they are counted. */
import { addDays, isMember, membersOf, nameOf, visibleMember, groupsOf } from './rules.js';
import { memberFacts } from './cache.js';

export const TEMPLATES = ['workouts', 'protein', 'weekend', 'bests'];
export const SPAN_DAYS = { week: 7, twoWeeks: 14, month: 28 };
export const SPANS = Object.keys(SPAN_DAYS);
export const ACTIVE_MAX = 3;
// How long a finished challenge stays on the group page, and in the file.
export const RECENT_DAYS = 7;
export const KEEP_DAYS = 60;

const PER_WEEK = { workouts: 3, protein: 5, weekend: 2 };
const isWeekend = date => [0, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay());
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

export const weeksOf = span => SPAN_DAYS[span] / 7;
export const perPersonOf = (template, span) => (template === 'bests' ? 1 : PER_WEEK[template] * weeksOf(span));
export const endOf = (start, span) => addDays(start, SPAN_DAYS[span] - 1);

// English fallback text; the client words the template itself.
export function textOf(template, span) {
  const n = perPersonOf(template, span);
  const weeks = weeksOf(span);
  const when = weeks === 1 ? 'this week' : `in ${weeks} weeks`;
  if (template === 'workouts') return { title: `Everyone trains ${n}x ${when}`, detail: `Finished workouts count, up to ${n} each.` };
  if (template === 'protein') return { title: `Protein target ${n} of ${SPAN_DAYS[span]} days`, detail: `Days the protein target was reached count, up to ${n} each.` };
  if (template === 'weekend') return { title: 'Weekend moving', detail: `A workout on a Saturday or Sunday counts, one per day, up to ${n} each.` };
  return { title: 'Each of us beats one best', detail: 'A new best, shared or not, counts once per person.' };
}

function countOf(template, facts, perPerson) {
  let raw;
  if (template === 'workouts') raw = sum(Object.values(facts.workouts), n => n);
  else if (template === 'protein') raw = facts.protein.length;
  else if (template === 'weekend') raw = Object.keys(facts.workouts).filter(isWeekend).length;
  else raw = facts.bests;
  return Math.min(perPerson, raw);
}

function weeklyStreak(data, ch) {
  if (ch.span !== 'week') return 0;
  const hits = new Set(Object.values(data.challenges)
    .filter(c => c && c.group === ch.group && c.template === ch.template && c.span === 'week' && typeof c.hitAt === 'string')
    .map(c => c.start));
  let n = 1;
  for (let wk = addDays(ch.start, -7); hits.has(wk); wk = addDays(wk, -7)) n++;
  return n;
}

/**
 * The full `Challenge` of `ch` for `viewer` on `date`, and whether it is hit (`hit`: a read that
 * sees this should settle it, see settleHits). `group` is the stored group of `ch`.
 */
export function challengeView({ data, active, viewer, group, ch, date, now = Date.now() }) {
  const perPerson = perPersonOf(ch.template, ch.span);
  const seen = (ch.joined || []).map(j => j.uid).filter(uid => isMember(group, uid) && visibleMember(data, uid, viewer, active));
  const joined = seen.map(uid => ({
    uid, name: nameOf(active.get(uid)), planned: perPerson,
    count: countOf(ch.template, memberFacts(uid, ch.start, ch.end, now), perPerson)
  }));
  const total = sum(joined, j => j.count);
  const goal = perPerson * joined.length;
  const hit = typeof ch.hitAt === 'string' || (goal > 0 && total >= goal);
  const state = hit ? 'done' : date > ch.end ? 'missed' : 'active';
  const streak = hit ? weeklyStreak(data, ch) : 0;
  // Who started it: the creator, or when they have left or are hidden, null (the client leaves the line out).
  const starter = ch.creator && isMember(group, ch.creator) && visibleMember(data, ch.creator, viewer, active) ? ch.creator : null;
  const view = {
    id: ch.id, group: ch.group, template: ch.template, ...textOf(ch.template, ch.span), span: ch.span,
    start: ch.start, end: ch.end, total, goal, perPerson, joined,
    startedBy: starter ? { uid: starter, name: nameOf(active.get(starter)) } : null,
    invited: membersOf(group).map(m => m.uid).filter(uid => visibleMember(data, uid, viewer, active) && !seen.includes(uid)),
    state, you: { in: seen.includes(viewer) },
    ...(streak >= 2 ? { streak } : {})
  };
  return { view, hit: hit && typeof ch.hitAt !== 'string' };
}

/** The ChallengeSummary row of a full Challenge. */
export const summaryOf = v => ({
  id: v.id, template: v.template, title: v.title, start: v.start, end: v.end, total: v.total, goal: v.goal,
  perPerson: v.perPerson, state: v.state, you: { in: v.you.in },
  joined: v.joined.map(j => ({ uid: j.uid })), invited: [...v.invited]
});

/** Writes `hitAt` on the challenges a read found hit, so a leave afterwards does not undo them. */
export function settleHits(store, ids, now = Date.now()) {
  if (!ids.length) return;
  try {
    store.mutate(d => {
      for (const id of ids) if (d.challenges[id] && typeof d.challenges[id].hitAt !== 'string') d.challenges[id].hitAt = new Date(now).toISOString();
    });
  } catch (e) {
    console.error('friends challenge not saved', e.message);
  }
}

/** The stored challenges of group `gid`, oldest first. */
export const challengesIn = (data, gid) => Object.values(data.challenges)
  .filter(c => c && c.group === gid && Array.isArray(c.joined))
  .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));

/** Challenges not over and not hit: what the cap of three counts. */
export const activeIn = (data, gid, date) => challengesIn(data, gid).filter(c => c.end >= date && typeof c.hitAt !== 'string');

/** ChallengeSummary rows for the group page: the running ones and those that ended in the last week. */
export function summariesFor({ data, active, viewer, group, date, store = null, now = Date.now() }) {
  const out = [], hits = [];
  for (const ch of challengesIn(data, group.id)) {
    if (ch.end < addDays(date, -RECENT_DAYS)) continue;
    const r = challengeView({ data, active, viewer, group, ch, date, now });
    if (r.hit) hits.push(ch.id);
    out.push(summaryOf(r.view));
  }
  if (store) settleHits(store, hits, now);
  return out;
}

/** Open challenges the viewer has not joined: `[{ cid, group: { id, name }, from: { name }, at }]`. */
export function challengeInvitesFor({ data, active, viewer, date }) {
  const out = [];
  if (!date) return out;
  for (const group of groupsOf(data, viewer)) {
    for (const ch of activeIn(data, group.id, date)) {
      if (ch.joined.some(j => j.uid === viewer)) continue;
      const from = [ch.creator, ...ch.joined.map(j => j.uid)]
        .find(uid => uid !== viewer && isMember(group, uid) && visibleMember(data, uid, viewer, active));
      if (!from) continue;
      out.push({ cid: ch.id, group: { id: group.id, name: typeof group.name === 'string' ? group.name : '' }, from: { name: nameOf(active.get(from)) }, at: ch.created });
    }
  }
  return out;
}
