/* The numbers on a GroupSummary, behind one function so the stats module can take them over
 * without touching the routes. api-m1 answers zeros; api-m2 replaces this body.
 *
 * `group` is the stored group, `viewer` the asking uid, `date` the client's local `YYYY-MM-DD`
 * (null on a write that carried none), `ctx.members` the visible member ids in join order. */
export function summaryNumbers(group, viewer, date, ctx = {}) {
  const goal = group?.goal || { kind: 'planned' };
  return {
    week: { done: 0, planned: 0 },
    streak: 0,
    // Structured, never a sentence: the client words it.
    goalLine: goal.kind === 'number' ? { kind: 'number', n: goal.n } : { kind: goal.kind }
  };
}
