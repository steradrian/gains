/* Friends api m2: what GET /groups/{id} and GET /groups/{id}/members/{uid} answer beyond the
 * summary, built field by field from the members' projections (stats.js). Nothing here reads a
 * state document; every value comes out of a projection, and every answer object is written out
 * key by key, so the allow-list in stats.js is the whole of what a member can see.
 *
 * Who shows: active accounts with Friends on, and the viewer themselves (rules.js visibleMember).
 * A muted member's moments are left out for that viewer only; the member still counts. With
 * nobody but the viewer counting ("Only you in the group") there are no moments, and the client
 * shows Invite in their place. */
import { membersOf, isMember, shareOf, visibleMember, nameOf, initialOf } from './rules.js';
import { daysOf } from './stats.js';
import { goalLineOf, groupWeek } from './week.js';
import { memberProjection } from './cache.js';
import { momentsOf } from './moments.js';
import { cheerCounts, cheerState, challengeSummaries } from './stats-hook.js';

export const MOMENTS_MAX = 30;

const mutedBy = (data, viewer, gid) => {
  const list = data.people[viewer]?.mutes?.[gid];
  return new Set(Array.isArray(list) ? list : []);
};
const removedIn = group => new Set(Array.isArray(group.removedMoments) ? group.removedMoments.filter(x => typeof x === 'string') : []);

// The row of someone who does not count (the viewer with Friends off): their own numbers, no
// high-water mark, in nobody's total.
function ownRow(data, uid, date) {
  const p = memberProjection(uid, shareOf(data.people[uid]), date);
  return { uid, p, done: p.done, planned: p.planned, noPlan: p.noPlan };
}

/** Every moment of the group on `date`, before mutes: what a removal is checked against. */
export function groupMoments({ data, group, date, active }) {
  const w = groupWeek({ data, gid: null, group, date, active });
  return momentsOf({ rows: w.rows, date, removed: removedIn(group) });
}

/**
 * The parts of `Group` that GET /groups/{id} adds to the summary, and the summary's numbers:
 * `{ summary: { week, streak, goalLine }, view: { targets, weekDays, members, challenges, moments,
 * cheersForMe, quiet } }`. Settles the week into `store` (week.js).
 */
export function groupDetail({ data, gid, group, viewer, date, active, store }) {
  const w = groupWeek({ data, gid, group, date, active, store });
  const muted = mutedBy(data, viewer, gid);
  const rowOf = new Map(w.rows.map(r => [r.uid, r]));
  const members = membersOf(group).map(m => m.uid).filter(uid => visibleMember(data, uid, viewer, active)).map(uid => {
    const r = rowOf.get(uid) || ownRow(data, uid, date);
    const name = nameOf(active.get(uid));
    return { uid, name, initial: initialOf(name), done: r.done, planned: r.planned, noPlan: r.noPlan, muted: muted.has(uid), you: uid === viewer };
  });
  const weekDays = daysOf(w.week).map((day, i) => ({
    date: day,
    workouts: w.rows.reduce((n, r) => n + (Array.isArray(r.p.dayCounts) ? r.p.dayCounts[i] || 0 : 0), 0)
  }));
  const others = w.rows.some(r => r.uid !== viewer);
  const moments = others
    ? momentsOf({ rows: w.rows, date, removed: removedIn(group) })
      .filter(m => !m.who.some(uid => muted.has(uid)))
      .slice(0, MOMENTS_MAX)
      .map(m => {
        const c = cheerState(viewer, group, { kind: 'moment', ref: m.id, who: m.who });
        return {
          id: m.id, kind: m.kind, who: [...m.who], title: m.title, detail: momentDetail(m), date: m.date, at: m.at,
          // The short thing a cheer names ("Cheered Mara's Legs"): the workout or the exercise; a
          // target moment has none (the client words "protein target").
          label: { title: typeof m.title === 'string' ? m.title : null },
          cheered: c.cheered === true, mine: c.mine === true
        };
      })
    : [];
  return {
    summary: { week: { done: w.totals.done, planned: w.totals.planned }, streak: w.streak, goalLine: goalLineOf(group.goal) },
    view: {
      targets: { hit: w.totals.targets.hit, of: w.totals.targets.of },
      weekDays,
      members,
      challenges: challengeSummaries(viewer, group, date),
      moments,
      cheersForMe: cheerCounts(viewer, group, w.week),
      quiet: w.rows.every(r => r.done === 0),
      // The viewer's own notification switch for this group (PUT /groups/{id}/prefs).
      muteNotifications: data.people[viewer]?.groupPrefs?.[gid]?.muteNotifications === true
    }
  };
}

// A moment's detail, key by key per kind.
function momentDetail(m) {
  const d = m.detail || {};
  if (m.kind === 'workout') return { minutes: d.minutes ?? null, exercises: d.exercises ?? 0 };
  if (m.kind === 'best') return { exercise: d.exercise };
  if (m.kind === 'target') return { target: d.target, days: d.days, of: d.of };
  return {};
}

/**
 * `Member` for `target` as `viewer` sees them, or null when the target is not someone the viewer
 * can see in this group (not a member, Friends off, a disabled account): the route answers that
 * like any unknown id. The target's own switches decide every field; `shares` says which.
 */
export function memberDetail({ data, gid, group, viewer, target, date, active, store }) {
  if (!isMember(group, target) || !visibleMember(data, target, viewer, active)) return null;
  const share = shareOf(data.people[target]);
  const w = groupWeek({ data, gid, group, date, active, store });
  const r = w.rows.find(x => x.uid === target) || ownRow(data, target, date);
  const p = r.p;
  const joined = membersOf(group).find(m => m.uid === target)?.joined;
  const out = {
    uid: target,
    name: nameOf(active.get(target)),
    since: typeof joined === 'string' ? joined : null,
    cheered: target !== viewer && cheerState(viewer, group, { kind: 'week', ref: `${w.week}:${target}`, who: [target] }).cheered === true,
    week: r.noPlan ? { noPlan: true } : { done: r.done, planned: r.planned, ...(share.training && Array.isArray(p.days) ? { days: [...p.days] } : {}) }
  };
  if (share.training && Array.isArray(p.recent)) out.recent = p.recent.map(x => ({ title: x.title, date: x.date, minutes: x.minutes }));
  if (share.consistency && Array.isArray(p.consistency)) out.consistency = p.consistency.map(c => ({ week: c.week, share: c.share }));
  if (share.targets && p.targets) out.targets = { reached: p.targets.reached, of: p.targets.of, days: [...p.targets.days] };
  if (Array.isArray(p.bests)) out.bests = p.bests.map(b => ({ id: b.id, exercise: b.exercise, date: b.date }));
  out.shares = { training: share.training, consistency: share.consistency, targets: share.targets, bests: share.bests };
  return out;
}
