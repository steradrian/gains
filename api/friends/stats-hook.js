/* The numbers on a GroupSummary, and the hooks api-m3 fills, behind functions so the routes and
 * the group view call them without knowing who computes them.
 *
 * Friends api m2: summaryNumbers is the group's week (week.js). cheerCounts, cheerState and
 * challengeSummaries are stubs that answer "none" until api-m3 replaces their bodies. */
import { isDate } from './rules.js';
import { goalLineOf, groupWeek, streakOf } from './week.js';

/**
 * `group` is the stored group, `viewer` the asking uid, `date` the client's local `YYYY-MM-DD`
 * (null on a write that carried none), `ctx` `{ gid, data, active, store }`: the group's id, the
 * store's document, the active accounts by id (rules.js accountMaps) and the store, which a read
 * settles the week into (week.js). Without a date or a document, the week is empty and the streak
 * is the one the group had at its last read.
 */
export function summaryNumbers(group, viewer, date, ctx = {}) {
  const goalLine = goalLineOf(group?.goal);
  if (!date || !ctx.data || !ctx.active) {
    const last = typeof group?.lastWeek === 'string' && isDate(group.lastWeek) ? group.lastWeek : null;
    return { week: { done: 0, planned: 0 }, streak: last ? streakOf(group, last, null) : 0, goalLine };
  }
  const w = groupWeek({ data: ctx.data, gid: ctx.gid, group, date, active: ctx.active, store: ctx.store || null });
  return { week: { done: w.totals.done, planned: w.totals.planned }, streak: w.streak, goalLine };
}

/** api-m3: how many cheers `viewer` got in `group` in the week starting `week`. */
export function cheerCounts(viewer, group, week) {
  return 0;
}

/** api-m3: whether `viewer` cheered `item` (`{ kind: 'moment' | 'week', ref, who: [uid] }`) in
 *  `group`, and whether the item is their own. */
export function cheerState(viewer, group, item) {
  return { cheered: false, mine: Array.isArray(item?.who) && item.who.includes(viewer) };
}

/** api-m3: the group's challenges as ChallengeSummary rows for `viewer` on `date`, each
 *  `{ id, template, title, start, end, total, goal, you: { in }, joined: [{ uid }], invited: [uid] }`
 *  (the shape group-m1's client reads; openapi.yaml ChallengeSummary). Only visible members
 *  (rules.js visibleMember) may appear in `joined` and `invited`. */
export function challengeSummaries(viewer, group, date) {
  return [];
}
