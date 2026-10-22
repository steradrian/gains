/* Friends api m3: cheers. One tap, no comments, no counts shown on a person.
 *
 *   POST   /cheers   { group, kind: 'moment' | 'week' | 'challenge', ref }
 *   DELETE /cheers   the same body: Undo, removes exactly what that POST stored
 *   GET    /cheers   this week's cheers for the viewer, newest first
 *
 * `ref` is a moment id (group-view moments), `<uid>:<week>` for "Cheer her week", or a challenge
 * id. Both people must be in the group and the target visible (rules.js visibleMember); anything
 * else, and a non-member, is 404. Cheering yourself is 400 `self`. A cheer is stored once per
 * (from, kind, ref, group), one record per recipient; repeating it changes nothing. A recipient who
 * muted the sender (or the group's notifications) still gets the record, it is only silent
 * (cheer-data.js). Records older than 14 days are dropped on every write.
 *
 * GET /cheers answers only what the viewer may see of their own: the label of a new best carries
 * the viewer's own weight and reps, read from the viewer's own state, and no other person's. The
 * unseen marker (`people[uid].seen`) moves only with `?seen=1`, never with the background poll. */
import { refuse, NOT_FOUND, onlyKeys } from './refusal.js';
import { friendsStore } from './store.js';
import { accountMaps, isDate, isId, isMember, nameOf, visibleMember, weekOf } from './rules.js';
import { parseMomentId } from './moments.js';
import { groupMoments } from './group-view.js';
import { readMemberState } from './cache.js';
import { plausibleDate, streakOf } from './week.js';
import { textOf } from './challenge-data.js';
import { CHEER_KEEP_MS, CHEER_KINDS, REF_MAX, atMs, cheerId, cheeredBy, liveCheersTo, sameCheer } from './cheer-data.js';

const NO_LABEL = (kind) => ({ kind, title: '', detail: '' });

/** The viewer's heaviest finished set of exercise `id` on `date`, as "60 kg x 8"; '' when none. */
export function ownBestSet(S, date, id) {
  let best = null;
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w || w.d !== date) continue;
    for (const en of Array.isArray(w.entries) ? w.entries : []) {
      if (!en || en.id !== id) continue;
      for (const s of Array.isArray(en.sets) ? en.sets : []) {
        if (s && s.done && s.w > 0 && s.r > 0 && (!best || s.w > best.w)) best = { w: s.w, r: s.r };
      }
    }
  }
  return best ? `${best.w} ${S.unit === 'lb' ? 'lb' : 'kg'} x ${best.r}` : '';
}

export function cheerRoutes({ json, readBody, readSession, users, store = friendsStore, route }) {
  const needUser = req => {
    const user = readSession(req);
    if (!user) refuse(401, null, 'not signed in');
    return user;
  };
  const query = req => new URL(req.url, 'http://x').searchParams;
  const needDate = q => {
    const d = q.get('date');
    if (!isDate(d)) refuse(400, 'bad-date', 'date must be a YYYY-MM-DD date');
    return d;
  };
  const groupFor = (d, gid, uid) => {
    const group = Object.hasOwn(d.groups, gid) ? d.groups[gid] : null;
    if (!group || !isMember(group, uid)) NOT_FOUND();
    return group;
  };
  function parseBody(body) {
    onlyKeys(body, ['group', 'kind', 'ref']);
    if (!isId(body.group)) refuse(400, 'bad-group', 'group must be a group id');
    if (!CHEER_KINDS.includes(body.kind)) refuse(400, 'bad-kind', 'kind is moment, week or challenge');
    if (typeof body.ref !== 'string' || !body.ref || body.ref.length > REF_MAX) refuse(400, 'bad-ref', 'ref must name a moment, a week or a challenge');
    return { gid: body.group, kind: body.kind, ref: body.ref };
  }

  // Who a cheer for this item goes to: the other people it names, each one visible to the cheerer.
  function recipientsOf(d, active, group, user, kind, ref) {
    let names;
    if (kind === 'moment') {
      const parsed = parseMomentId(ref);
      if (!parsed || !isDate(parsed.date)) refuse(400, 'bad-ref', 'not a moment id');
      names = groupMoments({ data: d, group, date: parsed.date, active }).find(m => m.id === ref)?.who;
      if (!names) NOT_FOUND();
    } else if (kind === 'week') {
      const parts = ref.split(':');
      if (parts.length !== 2 || !isId(parts[0]) || !isDate(parts[1]) || weekOf(parts[1]) !== parts[1]) refuse(400, 'bad-ref', 'a week is <uid>:<monday>');
      names = [parts[0]];
    } else {
      if (!isId(ref)) refuse(400, 'bad-ref', 'not a challenge id');
      const ch = Object.hasOwn(d.challenges, ref) ? d.challenges[ref] : null;
      if (!ch || ch.group !== group.id) NOT_FOUND();
      names = ch.joined.map(j => j.uid);
    }
    const others = names.filter(uid => uid !== user.id);
    if (!others.length) refuse(400, 'self', 'you cannot cheer yourself');
    const shown = others.filter(uid => isMember(group, uid) && visibleMember(d, uid, user.id, active));
    if (!shown.length) NOT_FOUND();
    return shown;
  }

  // The words a cheer is shown with. Built from the cheerer's moment for the recipient: a new
  // best carries the recipient's own set (they are the one it names), never anyone else's.
  function labelOf(d, active, viewer, c, memo) {
    if (c.kind === 'week') return NO_LABEL('week');
    if (c.kind === 'challenge') {
      const ch = d.challenges[c.ref];
      return { kind: 'challenge', title: ch ? textOf(ch.template, ch.span).title : '', detail: '' };
    }
    const parsed = parseMomentId(c.ref);
    if (!parsed) return NO_LABEL('workout');
    const key = `${c.group}|${parsed.date}`;
    if (!memo.has(key)) memo.set(key, groupMoments({ data: d, group: d.groups[c.group], date: parsed.date, active }));
    const m = memo.get(key).find(x => x.id === c.ref);
    if (!m) return NO_LABEL(parsed.kind);
    if (m.kind === 'workout') return { kind: 'workout', title: m.title || '', detail: m.detail?.minutes ? `${m.detail.minutes} min` : '' };
    if (m.kind === 'together') return { kind: 'together', title: m.title || '', detail: '' };
    if (m.kind === 'best') {
      const own = m.who.includes(viewer) ? ownBestSet(readMemberState(viewer), m.date, m.detail?.exercise) : '';
      return { kind: 'best', title: m.title || '', detail: own };
    }
    return NO_LABEL('target');
  }

  return {
    'POST /api/friends/cheers': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      const { gid, kind, ref } = parseBody(body);
      const q = query(req);
      const date = q.has('date') ? needDate(q) : null;
      store.mutate(d => {
        const group = groupFor(d, gid, user.id);
        if (d.people[user.id]?.on !== true) refuse(409, 'friends-off', 'Friends is off');
        const now = Date.now();
        d.cheers = d.cheers.filter(c => c && now - atMs(c) < CHEER_KEEP_MS);
        if (cheeredBy(d, user.id, gid, kind, ref)) return;
        const to = recipientsOf(d, accountMaps(users()).active, group, user, kind, ref);
        const day = date && plausibleDate(date, now) ? date : new Date(now).toISOString().slice(0, 10);
        const at = new Date(now).toISOString();
        for (const uid of to) d.cheers.push({ from: user.id, to: uid, group: gid, kind, ref, week: weekOf(day), at });
      });
      json(res, 200, { ok: true });
    }),

    // Undo: removes the records that POST stored for this (kind, ref) and nothing else. Nothing to
    // remove is still ok, so a second Undo is harmless.
    'DELETE /api/friends/cheers': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      const { gid, kind, ref } = parseBody(body);
      store.mutate(d => {
        groupFor(d, gid, user.id);
        d.cheers = d.cheers.filter(c => !(c && sameCheer(c, user.id, gid, kind, ref)));
      });
      json(res, 200, { ok: true });
    }),

    'GET /api/friends/cheers': route(async (req, res) => {
      const user = needUser(req);
      const q = query(req);
      const date = needDate(q);
      if (q.has('seen') && !['0', '1'].includes(q.get('seen'))) refuse(400, 'bad-seen', 'seen is 1 to mark these seen');
      const d = store.read();
      if (d.people[user.id]?.on !== true) { json(res, 200, []); return; }
      const { active } = accountMaps(users());
      const week = weekOf(date);
      const memo = new Map();
      const rows = liveCheersTo(d, active, user.id).filter(c => c.week === week).map(c => {
        const group = d.groups[c.group];
        const streak = c.kind === 'week' ? streakOf(group, week, group.results?.[week] === true) : 0;
        return {
          id: cheerId(c),
          from: { uid: c.from, name: nameOf(active.get(c.from)) },
          group: { id: c.group, name: typeof group.name === 'string' ? group.name : '' },
          kind: c.kind,
          ref: c.ref,
          ...(c.kind === 'moment' ? { moment: parseMomentId(c.ref)?.kind } : {}),
          label: labelOf(d, active, user.id, c, memo),
          ...(streak > 0 ? { streak } : {}),
          at: c.at
        };
      });
      if (q.get('seen') === '1') {
        store.mutate(doc => { if (doc.people[user.id]) doc.people[user.id].seen = new Date(Date.now()).toISOString(); });
      }
      json(res, 200, rows);
    })
  };
}
