/* Friends api m3: the numbers a challenge may count out of one person's synced state, and nothing
 * else. Like stats.js this is an allow-list: it returns counts and dates, never a name, a weight,
 * a food or a set. A new best counts as a number even when the person did not share it (the
 * exercise is never carried out). Pure; the state is handed in.
 *
 *   workouts   finished workouts per date in the range (a workout marked "Don't share this one"
 *              still counts as a session, as it does in the ring)
 *   protein    the dates in the range whose S.targetsReached[date].protein is true, and none at
 *              all unless the person shares targets (`targets`), whatever the state still holds
 *   bests      how many different catalogue exercises had a new best in the range */
import { isDate } from './rules.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function challengeFacts(S, from, to, { targets = false } = {}) {
  const workouts = {};
  const bests = new Set();
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!isObj(w) || !isDate(w.d) || w.d < from || w.d > to) continue;
    workouts[w.d] = (workouts[w.d] || 0) + 1;
    for (const id of Array.isArray(w.prs) ? w.prs : []) if (typeof id === 'string' && id.length <= 64) bests.add(id);
  }
  const protein = [];
  const reached = targets === true && isObj(S?.targetsReached) ? S.targetsReached : {};
  for (const [day, v] of Object.entries(reached)) {
    if (isDate(day) && day >= from && day <= to && isObj(v) && v.protein === true) protein.push(day);
  }
  return { workouts, protein: protein.sort(), bests: bests.size };
}
