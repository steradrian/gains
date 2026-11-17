/* The numbers on a GroupSummary, and the hooks api-m3 fills, behind functions so the routes and
 * the group view call them without knowing who computes them.
 *
 * Friends api m2: summaryNumbers is the group's week (week.js). Friends api m3: cheerCounts,
 * cheerState and challengeSummaries are filled (cheer-data.js, challenge-data.js). */
import { isDate } from './rules.js';
import { goalLineOf, groupWeek, streakOf, plausibleDate } from './week.js';
import { cheeredBy, cheersInWeek } from './cheer-data.js';
import { summariesFor } from './challenge-data.js';

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

/* Friends api m3: the three hooks below answer from `ctx` = { data, active } (and `store` for the
 * challenges, which settle what they saw). Without a document they answer "none", as the stubs did. */

/** How many cheers `viewer` got in `group` in the week starting `week` (cheer-data.js). */
export function cheerCounts(viewer, group, week, ctx = {}) {
  return ctx.data && ctx.active ? cheersInWeek(ctx.data, ctx.active, viewer, group?.id, week) : 0;
}

/** Whether `viewer` cheered `item` (`{ kind: 'moment' | 'week', ref, who: [uid] }`) in `group`,
 *  and whether the item is their own. A week's ref is `<uid>:<week>`. */
export function cheerState(viewer, group, item, ctx = {}) {
  return {
    cheered: !!ctx.data && cheeredBy(ctx.data, viewer, group?.id, item?.kind, item?.ref),
    mine: Array.isArray(item?.who) && item.who.includes(viewer)
  };
}

/** The group's challenges as ChallengeSummary rows for `viewer` on `date` (challenge-data.js); only
 *  visible members appear in `joined` and `invited`. */
export function challengeSummaries(viewer, group, date, ctx = {}) {
  if (!ctx.data || !ctx.active || !isDate(date)) return [];
  return summariesFor({ data: ctx.data, active: ctx.active, viewer, group, date, store: ctx.store && plausibleDate(date) ? ctx.store : null });
}
