/* Friends api m2: a group's moments, derived on read for the last seven days from what each
 * member shares. Pure over the projections (stats.js memberWeek), never over a state document, so
 * a moment can only say what the projection already let out.
 *
 *   workout    a finished workout: its name, minutes and exercise count (training shared, the
 *              workout not marked "Don't share this one")
 *   together   two or more members, the same routine (by name, else id), the same date; automatic
 *   best       a new best, the catalogue exercise only (shared by the switch or for that workout)
 *   target     the protein target reached on TARGET_MOMENT_DAYS days of this week (targets shared)
 *
 * Ids are stable, `<kind>:<date>:<uids sorted, joined by +>:<ref>`, so a removal (the group's
 * `removedMoments`, by either participant) and a cheer (api-m3) find the same moment on every
 * read. A ref is opaque (stats.js refOf) or a catalogue id; it never holds a name. */
import { addDays } from './rules.js';
import { MOMENT_DAYS, TARGET_MOMENT_DAYS } from './stats.js';

export const MOMENT_KINDS = ['workout', 'together', 'best', 'target'];
const MID_RE = /^(workout|together|best|target):(\d{4}-\d{2}-\d{2}):([A-Za-z0-9_+-]+):([A-Za-z0-9_-]{1,64})$/;

export const momentId = (kind, date, uids, ref) => `${kind}:${date}:${[...uids].sort().join('+')}:${ref}`;

/** `{ kind, date, who }` of a well-formed moment id, else null. */
export function parseMomentId(mid) {
  const m = typeof mid === 'string' && mid.length <= 400 ? MID_RE.exec(mid) : null;
  if (!m) return null;
  const who = m[3].split('+');
  if (who.some(u => !/^[A-Za-z0-9_-]{1,64}$/.test(u))) return null;
  return { kind: m[1], date: m[2], who };
}

const newestFirst = (a, b) =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.at || '') < (b.at || '') ? 1 : (a.at || '') > (b.at || '') ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Every moment of `rows` (`[{ uid, p }]`, members in join order, `p` their projection on `date`)
 * from the seven days up to `date`, newest first, without the ids in `removed`. Each is
 * `{ id, kind, who, title, detail, date, at }`; the caller drops muted members and adds cheers.
 */
export function momentsOf({ rows, date, removed = new Set() }) {
  const from = addDays(date, -(MOMENT_DAYS - 1));
  const inWindow = d => typeof d === 'string' && d >= from && d <= date;
  const out = [];
  const together = new Map();
  for (const { uid, p } of rows) {
    for (const w of p.workouts || []) {
      if (!inWindow(w.date)) continue;
      out.push({ id: momentId('workout', w.date, [uid], w.ref), kind: 'workout', who: [uid], title: w.title, detail: { minutes: w.minutes, exercises: w.exercises }, date: w.date, at: w.at });
      if (!w.together) continue;
      const key = `${w.date}|${w.together}`;
      const t = together.get(key) || { date: w.date, ref: w.together, title: w.title, at: null, who: [] };
      if (!t.who.includes(uid)) t.who.push(uid);
      if (w.at && (!t.at || w.at > t.at)) t.at = w.at;
      together.set(key, t);
    }
    for (const b of p.bestMoments || []) {
      if (!inWindow(b.date)) continue;
      out.push({ id: momentId('best', b.date, [uid], b.id), kind: 'best', who: [uid], title: b.exercise, detail: { exercise: b.id }, date: b.date, at: null });
    }
    const pr = p.protein;
    if (pr && pr.days >= TARGET_MOMENT_DAYS && inWindow(pr.reachedOn)) {
      out.push({ id: momentId('target', pr.reachedOn, [uid], `protein-${pr.week}`), kind: 'target', who: [uid], title: null, detail: { target: 'protein', days: pr.days, of: 7 }, date: pr.reachedOn, at: null });
    }
  }
  for (const t of together.values()) {
    if (t.who.length < 2) continue;
    out.push({ id: momentId('together', t.date, t.who, t.ref), kind: 'together', who: [...t.who], title: t.title, detail: {}, date: t.date, at: t.at });
  }
  return out.filter(m => !removed.has(m.id)).sort(newestFirst);
}
