/* Friends api m3: challenges. The counting rules, states and streak are in challenge-data.js.
 *
 *   POST /groups/{id}/challenges              { template, span } -> Challenge; the creator is in,
 *                                             everyone else is invited and joins on their own
 *   GET  /groups/{id}/challenges/{cid}        Challenge
 *   POST /groups/{id}/challenges/{cid}/join   Challenge; joining twice changes nothing
 *   POST /groups/{id}/challenges/{cid}/leave  Challenge; takes only that person's work off the bar
 *
 * Only members of the group, and a non-member gets the same 404 as an unknown id. At most three
 * running (not over, not reached) challenges per group (409 `challenge-limit`). `date` is the
 * client's local today; a write takes it only when it can be someone's today (week.js
 * plausibleDate), else, or without one, the server's UTC date. A far-future date therefore cannot
 * start a challenge years out, fill the cap or end anything early. Finished challenges are dropped
 * KEEP_DAYS after their end, by the server's clock and only in the group being written to. */
import { randomBytes } from 'node:crypto';
import { refuse, NOT_FOUND, onlyKeys } from './refusal.js';
import { friendsStore } from './store.js';
import { accountMaps, addDays, isDate, isId, isMember, weekOf } from './rules.js';
import { clientDay, plausibleDate, serverDay } from './week.js';
import { ACTIVE_MAX, KEEP_DAYS, SPANS, TEMPLATES, activeIn, challengeView, endOf, settleHits } from './challenge-data.js';

export function challengeRoutes({ json, readBody, readSession, users, store = friendsStore, route }) {
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
  // A write's day: the client's date when plausible, else the server's.
  const dayOf = (q, now = Date.now()) => (q.has('date') ? clientDay(needDate(q), now) : serverDay(now));
  // Retention runs off the server clock and only over `gid`, so no request can reach another group.
  const sweep = (d, gid, now = Date.now()) => {
    const cutoff = addDays(serverDay(now), -KEEP_DAYS);
    for (const [cid, c] of Object.entries(d.challenges)) {
      if (!c) delete d.challenges[cid];
      else if (c.group === gid && c.end < cutoff) delete d.challenges[cid];
    }
  };
  const groupFor = (d, req, uid) => {
    const gid = req.friendsParams?.id;
    const group = isId(gid) && Object.hasOwn(d.groups, gid) ? d.groups[gid] : null;
    if (!group || !isMember(group, uid)) NOT_FOUND();
    return group;
  };
  const challengeFor = (d, req, group) => {
    const cid = req.friendsParams?.cid;
    const ch = isId(cid) && Object.hasOwn(d.challenges, cid) ? d.challenges[cid] : null;
    if (!ch || ch.group !== group.id || !Array.isArray(ch.joined)) NOT_FOUND();
    return ch;
  };
  const needOn = (d, uid) => {
    if (d.people[uid]?.on !== true) refuse(409, 'friends-off', 'Friends is off');
  };
  // The Challenge as `viewer` sees it on `date`; a read that finds the goal reached records it.
  function answer(d, group, ch, viewer, date) {
    const now = Date.now();
    const r = challengeView({ data: d, active: accountMaps(users()).active, viewer, group, ch, date, now });
    if (r.hit && plausibleDate(date, now)) settleHits(store, [ch.id], now);
    return r.view;
  }

  return {
    'POST /api/friends/groups/{id}/challenges': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['template', 'span']);
      if (!TEMPLATES.includes(body.template)) refuse(400, 'bad-template', 'template is workouts, protein, weekend or bests');
      if (!SPANS.includes(body.span)) refuse(400, 'bad-span', 'span is week, twoWeeks or month');
      const day = dayOf(query(req));
      const id = store.mutate(d => {
        const group = groupFor(d, req, user.id);
        needOn(d, user.id);
        sweep(d, group.id);
        if (activeIn(d, group.id, day).length >= ACTIVE_MAX) refuse(409, 'challenge-limit', `at most ${ACTIVE_MAX} running challenges`);
        let cid;
        do { cid = randomBytes(9).toString('base64url'); } while (Object.hasOwn(d.challenges, cid));
        const start = weekOf(day);
        const at = new Date().toISOString();
        d.challenges[cid] = {
          id: cid, group: group.id, template: body.template, span: body.span,
          start, end: endOf(start, body.span), creator: user.id, created: at, joined: [{ uid: user.id, at }]
        };
        return cid;
      });
      const d = store.read();
      json(res, 200, answer(d, d.groups[d.challenges[id].group], d.challenges[id], user.id, day));
    }),

    'GET /api/friends/groups/{id}/challenges/{cid}': route(async (req, res) => {
      const user = needUser(req);
      const date = needDate(query(req));
      const d = store.read();
      const group = groupFor(d, req, user.id);
      json(res, 200, answer(d, group, challengeFor(d, req, group), user.id, date));
    }),

    'POST /api/friends/groups/{id}/challenges/{cid}/join': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      const day = dayOf(query(req));
      const ch = store.mutate(d => {
        const group = groupFor(d, req, user.id);
        const found = challengeFor(d, req, group);
        needOn(d, user.id);
        if (found.joined.some(j => j.uid === user.id)) return found.id;
        if (found.end < day) refuse(409, 'challenge-ended', 'this challenge is over');
        found.joined.push({ uid: user.id, at: new Date().toISOString() });
        return found.id;
      });
      const d = store.read();
      json(res, 200, answer(d, d.groups[d.challenges[ch].group], d.challenges[ch], user.id, day));
    }),

    // Counts are computed from who is in, so leaving is the whole of it. No confirm; joining again
    // is the Undo and brings the same work back.
    'POST /api/friends/groups/{id}/challenges/{cid}/leave': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      const day = dayOf(query(req));
      const ch = store.mutate(d => {
        const group = groupFor(d, req, user.id);
        const found = challengeFor(d, req, group);
        found.joined = found.joined.filter(j => j.uid !== user.id);
        return found.id;
      });
      const d = store.read();
      json(res, 200, answer(d, d.groups[d.challenges[ch].group], d.challenges[ch], user.id, day));
    })
  };
}
