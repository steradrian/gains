/* HTTP surface for Friends: groups of people who see each other's training, never ranked.
 *
 * A factory handed server.js's own helpers, like ../coach/routes.js, so this module has no cycle
 * back into the server and every route is a closure over the one store.
 *
 * Rules every route here keeps:
 *   - Signed in, always. A group id the caller is not a member of answers exactly what an id that
 *     does not exist answers (404 `not-found`), so ids never leak which groups exist.
 *   - Names come from db.users at answer time. A member id that is no longer an account (a purge
 *     that could not write) is skipped on every read; a member with Friends off, and a disabled
 *     account (Friends api m2: hidden, never purged, since enabling it brings everything back),
 *     are left out of what other members see.
 *   - Friends api m2: what one member shows of their training comes only out of the share
 *     projection (stats.js), read through group-view.js.
 *   - No answer carries `usedBy`, an e-mail, or the id of anyone outside the caller's group,
 *     except GET /people, whose whole point is the ids of people who opted in to being invited.
 *   - Every change is one synchronous store.mutate, check and write together, so two requests
 *     can never both pass a check that only one of them should (an invite redeemed twice).
 *   - A profile awaiting deletion may still leave, remove, mute and turn Friends off, never join,
 *     create, invite or share more (423, as PUT /api/data answers it).
 */
import { createWindow } from '../rate-limit.js';
import { friendsStore } from './store.js';
import {
  GROUP_CAP, GROUPS_PER_PERSON, SHARE_KEYS, cleanText, groupName, parseGoal, parseShare, shareOf, isId,
  isMember, membersOf, newGroupId, newGroup, addMember, dropMember, groupsOf, isDate, nameOf, initialOf,
  accountMaps, visibleMember, addDays
} from './rules.js';
import { codeOf, newCode, newGroupInvite, lookupInvite, redeem, tidyInvites, hasOpenInvitation } from './invites.js';
import { summaryNumbers } from './stats-hook.js';
// Friends api m2
import { invalidateMember } from './cache.js';
import { groupDetail, memberDetail, groupMoments } from './group-view.js';
import { parseMomentId } from './moments.js';
import { MOMENT_DAYS } from './stats.js';
// Friends api m3
import { Refusal, refuse, NOT_FOUND, isObj, onlyKeys, routeWith } from './refusal.js';
import { meExtras } from './me-extras.js';
import { cheerRoutes } from './cheers.js';
import { challengeRoutes } from './challenges.js';

export const PEOPLE_MAX = 20;
export const SUMMARY_MEMBERS_MAX = 5;
export const PREVIEW_INITIALS_MAX = 4;

/* ---------- path templates ---------- */
// A literal segment that is followed by a parameter, and that parameter's name. Everything else is
// a literal. `/api/friends/groups/X/members/Y/remove` is `.../groups/{id}/members/{uid}/remove`.
const PARAM_AFTER = { groups: 'id', members: 'uid', moments: 'mid', challenges: 'cid', join: 'code' };

/**
 * The route-table template of a Friends path with parameters in it, and the parameters; null for
 * a path that has none (`/api/friends/me` is looked up as it is). A parameter that does not decode
 * is null, and its route answers it like an unknown id.
 */
export function friendsRouteKey(pathname) {
  const base = '/api/friends/';
  if (typeof pathname !== 'string' || !pathname.startsWith(base)) return null;
  const segs = pathname.slice(base.length).split('/');
  if (segs.some(s => s === '')) return null;
  const parts = [], params = {};
  for (let i = 0; i < segs.length; i++) {
    const name = PARAM_AFTER[segs[i]];
    parts.push(segs[i]);
    if (name && i + 1 < segs.length) {
      let v = null;
      try { v = decodeURIComponent(segs[i + 1]); } catch { /* answered as unknown */ }
      params[name] = v;
      parts.push(`{${name}}`);
      i++;
    }
  }
  if (!Object.keys(params).length) return null;
  return { template: base + parts.join('/'), params };
}

export function friendsRoutes({ json, readBody, readSession, limitAddress, users, deletionScheduled = () => false, store = friendsStore }) {
  // GET and POST /join/{code}: 30 a minute per address and 600 for everyone together, the budget
  // GET /api/invites/{code} has. Counted only once the caller is signed in, so a flood from
  // nobody cannot spend the shared budget for the people who are.
  const JOIN_CHECKS = createWindow({ max: 30, windowMs: 60000 });
  const JOIN_CHECKS_ALL = createWindow({ max: 600, windowMs: 60000, maxKeys: 1 });
  setInterval(() => { JOIN_CHECKS.sweep(); JOIN_CHECKS_ALL.sweep(); }, 60000).unref();

  const route = routeWith(json);
  const needUser = req => {
    const user = readSession(req);
    if (!user) refuse(401, null, 'not signed in');
    return user;
  };
  const notPaused = user => {
    if (deletionScheduled(user)) refuse(423, 'deletion-scheduled', 'deletion scheduled');
  };
  const query = req => new URL(req.url, 'http://x').searchParams;
  // The client's local today. Required on the reads (the server never guesses a time zone);
  // optional on a write, whose answer carries the same summary.
  const needDate = q => {
    const d = q.get('date');
    if (!isDate(d)) refuse(400, 'bad-date', 'date must be a YYYY-MM-DD date');
    return d;
  };
  const optDate = q => (q.has('date') ? needDate(q) : null);
  const limitJoin = req => {
    const wait = JOIN_CHECKS.take(limitAddress(req)) || JOIN_CHECKS_ALL.take('all');
    if (wait) {
      const e = new Refusal(429, { error: 'too many invite checks, try again shortly', code: 'rate-limited', retryAfter: wait });
      e.headers = { 'Retry-After': String(wait) };
      throw e;
    }
  };

  // Friends api m2: `accounts` every account that exists (a disabled one keeps its place: the cap,
  // the creator role), `active` the ones Friends shows (rules.js accountMaps).
  const accounts = () => accountMaps(users());
  const isOn = (d, uid) => d.people[uid]?.on === true;
  const personFor = (d, uid) => {
    if (!isObj(d.people[uid])) d.people[uid] = { on: false, mutes: {}, groupPrefs: {} };
    const p = d.people[uid];
    if (!isObj(p.mutes)) p.mutes = {};
    if (!isObj(p.groupPrefs)) p.groupPrefs = {};
    return p;
  };
  /** The group `req` names, when `uid` is a member of it; the not-found refusal otherwise. */
  const memberGroup = (d, req, uid) => {
    const gid = req.friendsParams?.id;
    const group = isId(gid) && Object.hasOwn(d.groups, gid) ? d.groups[gid] : null;
    if (!isObj(group) || !isMember(group, uid)) NOT_FOUND();
    return { gid, group };
  };
  // Places taken in a group: every account that exists, a disabled one too (it comes back on enable).
  const liveCount = (group, all) => membersOf(group).filter(m => all.has(m.uid)).length;
  // Who the viewer sees: active accounts with Friends on, and always themselves.
  const visibleMembers = (d, group, viewer, active) => membersOf(group)
    .filter(m => visibleMember(d, m.uid, viewer, active))
    .map(m => active.get(m.uid));
  // The creator, or when that account is gone, the longest-standing member who is not. A disabled
  // creator stays creator: nobody can remove until they are enabled again.
  const creatorOf = (group, all) => (all.has(group.creator) ? group.creator : membersOf(group).find(m => all.has(m.uid))?.uid ?? null);

  /* ---------- answers, built field by field ---------- */
  // `nums` (Friends api m2): the numbers when the caller computed them already (GET /groups/{id}).
  function groupSummary(d, gid, group, viewer, date, maps, nums = null) {
    const visible = visibleMembers(d, group, viewer, maps.active);
    nums ??= summaryNumbers(group, viewer, date, { gid, data: d, active: maps.active, store });
    return {
      id: gid,
      name: typeof group.name === 'string' ? group.name : '',
      since: typeof group.created === 'string' ? group.created : null,
      memberCount: visible.length,
      members: visible.slice(0, SUMMARY_MEMBERS_MAX).map(u => ({ uid: u.id, name: nameOf(u), initial: initialOf(nameOf(u)) })),
      week: { done: nums.week.done, planned: nums.week.planned },
      streak: nums.streak,
      goalLine: nums.goalLine
    };
  }
  // What a create or a join answers: the summary plus the goal and who created it. The whole
  // Group (ring, moments, members' weeks) is GET /groups/{id}.
  function groupAnswer(d, gid, viewer, date, nums = null) {
    const maps = accounts();
    const group = d.groups[gid];
    const creator = creatorOf(group, maps.accounts);
    const visible = new Set(visibleMembers(d, group, viewer, maps.active).map(u => u.id));
    return {
      ...groupSummary(d, gid, group, viewer, date, maps, nums),
      goal: group.goal?.kind === 'number' ? { kind: 'number', n: group.goal.n } : { kind: group.goal?.kind || 'planned' },
      creator: visible.has(creator) ? creator : null,
      isCreator: creator === viewer
    };
  }
  // In-app invitations still open for `viewer`, one per group (the newest). One from a disabled
  // account does not show while it is (`active`).
  function invitationsFor(d, viewer, active) {
    const byGroup = new Map();
    for (const x of d.invitations) {
      if (!x || x.to !== viewer) continue;
      const found = lookupInvite(d, x.code, viewer);
      if (!found || found.status !== 'valid') continue;
      const from = active.get(x.from);
      if (!from || !isMember(found.group, x.from)) continue;
      byGroup.set(x.group, { code: x.code, group: { id: x.group, name: found.group.name }, from: { name: nameOf(from) } });
    }
    return [...byGroup.values()];
  }
  function meAnswer(viewer, date) {
    const d = store.read();
    const maps = accounts();
    const person = d.people[viewer];
    return {
      on: person?.on === true,
      share: shareOf(person),
      groups: groupsOf(d, viewer).map(g => groupSummary(d, g.id, g, viewer, date, maps)),
      invitations: invitationsFor(d, viewer, maps.active),
      // Friends api m3: newCount, newest (omitted when nothing is new), challengeInvites.
      ...meExtras(viewer, date, { data: d, active: maps.active })
    };
  }

  return {
    'GET /api/friends/me': route(async (req, res) => {
      const user = needUser(req);
      json(res, 200, meAnswer(user.id, needDate(query(req))));
    }),

    // `on: true` with no share switches ever chosen is refused: the client opens What you share
    // first. Off keeps the switches and the memberships; the person is only hidden meanwhile.
    'PUT /api/friends/me': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['on', 'share']);
      if (body.on !== undefined && typeof body.on !== 'boolean') refuse(400, 'bad-on', 'on must be true or false');
      const date = optDate(query(req));
      store.mutate(d => {
        const stored = d.people[user.id];
        const share = body.share === undefined ? undefined : parseShare(body.share, stored?.share);
        if (share === null) refuse(400, 'bad-share', 'share takes training, consistency, targets and bests, each true or false');
        // Turning on, or a switch going on, shares more; switching things off never waits.
        const more = share && SHARE_KEYS.some(k => share[k] && stored?.share?.[k] !== true);
        if ((body.on === true && stored?.on !== true) || more) notPaused(user);
        if (body.on === true && !share && !isObj(stored?.share)) refuse(409, 'needs-share', 'choose what to share first');
        if (share === undefined && body.on === undefined) return;
        const person = personFor(d, user.id);
        if (share) person.share = share;
        if (body.on !== undefined) person.on = body.on;
      });
      // Friends api m2: nothing projected under the old switches is served again.
      invalidateMember(user.id);
      json(res, 200, meAnswer(user.id, date));
    }),

    'POST /api/friends/groups': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['name', 'goal']);
      const name = groupName(body.name);
      if (!name) refuse(400, 'bad-name', 'a group needs a name of 1 to 40 characters');
      const goal = parseGoal(body.goal);
      if (!goal) refuse(400, 'bad-goal', "goal is { kind: 'planned' | 'targets' } or { kind: 'number', n: 1..200 }");
      const date = optDate(query(req));
      notPaused(user);
      const gid = store.mutate(d => {
        if (!isOn(d, user.id)) refuse(409, 'friends-off', 'Friends is off');
        if (groupsOf(d, user.id).length >= GROUPS_PER_PERSON) refuse(409, 'group-limit', `at most ${GROUPS_PER_PERSON} groups`);
        let id;
        do { id = newGroupId(); } while (Object.hasOwn(d.groups, id));
        d.groups[id] = newGroup({ id, name, goal, creator: user.id, now: Date.now() });
        return id;
      });
      json(res, 200, groupAnswer(store.read(), gid, user.id, date));
    }),

    'GET /api/friends/groups': route(async (req, res) => {
      const user = needUser(req);
      const date = needDate(query(req));
      const d = store.read();
      const maps = accounts();
      json(res, 200, groupsOf(d, user.id).map(g => groupSummary(d, g.id, g, user.id, date, maps)));
    }),

    // The last one out deletes the group; a creator leaving hands it to the longest-standing member.
    'POST /api/friends/groups/{id}/leave': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      store.mutate(d => {
        const { gid } = memberGroup(d, req, user.id);
        dropMember(d, gid, user.id, Date.now());
      });
      json(res, 200, { ok: true });
    }),

    'POST /api/friends/groups/{id}/members/{uid}/remove': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      const target = req.friendsParams?.uid;
      store.mutate(d => {
        const { gid, group } = memberGroup(d, req, user.id);
        if (target === user.id) refuse(400, 'self', 'leave the group instead');
        if (creatorOf(group, accounts().accounts) !== user.id) refuse(403, 'forbidden', 'only the creator can remove a member');
        if (!isId(target) || !isMember(group, target)) NOT_FOUND();
        dropMember(d, gid, target, Date.now());
      });
      json(res, 200, { ok: true });
    }),

    // Per viewer: hides that member's moments for the caller only. The muted person is never told
    // and still counts.
    'PUT /api/friends/groups/{id}/mutes': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['uid', 'muted']);
      if (!isId(body.uid)) refuse(400, 'bad-uid', 'uid names no member');
      if (typeof body.muted !== 'boolean') refuse(400, 'bad-muted', 'muted must be true or false');
      store.mutate(d => {
        const { gid, group } = memberGroup(d, req, user.id);
        if (body.uid === user.id) refuse(400, 'self', 'you cannot mute yourself');
        if (!isMember(group, body.uid)) refuse(400, 'bad-uid', 'uid names no member');
        const p = personFor(d, user.id);
        const list = new Set(Array.isArray(p.mutes[gid]) ? p.mutes[gid] : []);
        if (body.muted) list.add(body.uid); else list.delete(body.uid);
        if (list.size) p.mutes[gid] = [...list]; else delete p.mutes[gid];
      });
      json(res, 200, { ok: true });
    }),

    'PUT /api/friends/groups/{id}/prefs': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['muteNotifications']);
      if (typeof body.muteNotifications !== 'boolean') refuse(400, 'bad-prefs', 'muteNotifications must be true or false');
      store.mutate(d => {
        const { gid } = memberGroup(d, req, user.id);
        personFor(d, user.id).groupPrefs[gid] = { muteNotifications: body.muteNotifications };
      });
      json(res, 200, { ok: true });
    }),

    // A one-time link, seven days. Any member may mint, and hold several.
    'POST /api/friends/groups/{id}/invites': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      notPaused(user);
      const out = store.mutate(d => {
        const { gid, group } = memberGroup(d, req, user.id);
        if (!isOn(d, user.id)) refuse(409, 'friends-off', 'Friends is off');
        if (liveCount(group, accounts().accounts) >= GROUP_CAP) refuse(409, 'group-full', `a group has at most ${GROUP_CAP} people`);
        const now = Date.now();
        tidyInvites(d, gid, user.id, now);
        const code = newCode(c => Object.hasOwn(d.invites, c));
        d.invites[code] = newGroupInvite({ group: gid, by: user.id, now });
        return { code, url: `g/${code}`, expiresAt: d.invites[code].expiresAt };
      });
      json(res, 200, out);
    }),

    // People who opted in to Friends, by name, to invite in-app: name and the month they joined
    // Gains, nothing else. `group` leaves out that group's members (the caller must be one).
    'GET /api/friends/people': route(async (req, res) => {
      const user = needUser(req);
      const q = query(req);
      const term = cleanText(q.get('q') || '').toLocaleLowerCase();
      const d = store.read();
      if (!isOn(d, user.id)) refuse(409, 'friends-off', 'Friends is off');
      const skip = new Set([user.id]);
      if (q.has('group')) {
        const { group } = memberGroup(d, { friendsParams: { id: q.get('group') } }, user.id);
        for (const m of membersOf(group)) skip.add(m.uid);
      }
      const list = [...accounts().active.values()]
        .filter(u => !skip.has(u.id) && !deletionScheduled(u) && isOn(d, u.id) && nameOf(u)
          && (!term || nameOf(u).toLocaleLowerCase().includes(term)))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
        .slice(0, PEOPLE_MAX)
        .map(u => ({ uid: u.id, name: nameOf(u), since: typeof u.created === 'string' && /^\d{4}-\d{2}/.test(u.created) ? u.created.slice(0, 7) : null }));
      json(res, 200, list);
    }),

    // An in-app invitation: a code bound to that one person, listed in their GET /me. The answer
    // is the same `{ ok: true }` whether the uid is an account, has Friends on, or neither: this
    // never confirms that another account exists.
    'POST /api/friends/groups/{id}/invites/user': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, ['uid']);
      if (!isId(body.uid)) refuse(400, 'bad-uid', 'uid must be an account id');
      notPaused(user);
      store.mutate(d => {
        const { gid, group } = memberGroup(d, req, user.id);
        if (!isOn(d, user.id)) refuse(409, 'friends-off', 'Friends is off');
        const maps = accounts();
        if (liveCount(group, maps.accounts) >= GROUP_CAP) refuse(409, 'group-full', `a group has at most ${GROUP_CAP} people`);
        const to = body.uid;
        const target = maps.active.get(to);
        const now = Date.now();
        if (to === user.id || !target || deletionScheduled(target) || !isOn(d, to) || isMember(group, to) || hasOpenInvitation(d, gid, to, now)) return;
        tidyInvites(d, gid, user.id, now);
        const code = newCode(c => Object.hasOwn(d.invites, c));
        d.invites[code] = newGroupInvite({ group: gid, by: user.id, to, now });
        d.invitations.push({ code, group: gid, from: user.id, to });
      });
      json(res, 200, { ok: true });
    }),

    // The join page's preview. Unknown, malformed and someone else's in-app code all answer the
    // same 404. Names nobody in the group: the count, up to four initials, and who sent it. The
    // group itself only while the code would let the caller in (or they are in already).
    'GET /api/friends/join/{code}': route(async (req, res) => {
      const user = needUser(req);
      limitJoin(req);
      const d = store.read();
      const found = lookupInvite(d, codeOf(req.friendsParams?.code), user.id);
      if (!found) NOT_FOUND();
      const { active } = accounts();
      const from = active.get(found.inv.by);
      const out = { status: found.status, from: { name: from ? nameOf(from) || null : null } };
      if (found.status === 'valid' || found.status === 'member') {
        const visible = visibleMembers(d, found.group, user.id, active);
        out.group = {
          id: found.inv.group,
          name: typeof found.group.name === 'string' ? found.group.name : '',
          memberCount: visible.length,
          initials: visible.slice(0, PREVIEW_INITIALS_MAX).map(u => initialOf(nameOf(u)))
        };
      }
      json(res, 200, out);
    }),

    // Redeeming. The status check, the use and the new membership are one mutate: of two requests
    // for the same code, exactly one gets in.
    'POST /api/friends/join/{code}': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      limitJoin(req);
      const date = optDate(query(req));
      const code = codeOf(req.friendsParams?.code);
      const gid = store.mutate(d => {
        const now = Date.now();
        const found = lookupInvite(d, code, user.id, now);
        if (!found) NOT_FOUND();
        const id = found.inv.group;
        if (found.status === 'member') refuse(409, 'already-member', 'already in this group', { group: { id } });
        if (found.status === 'used') refuse(410, 'invite-used', 'this invite has been used');
        if (found.status !== 'valid') refuse(410, 'invite-expired', 'this invite has expired');
        notPaused(user);
        if (!isOn(d, user.id)) refuse(409, 'friends-off', 'Friends is off');
        if (liveCount(found.group, accounts().accounts) >= GROUP_CAP) refuse(409, 'group-full', `a group has at most ${GROUP_CAP} people`);
        if (groupsOf(d, user.id).length >= GROUPS_PER_PERSON) refuse(409, 'group-limit', `at most ${GROUPS_PER_PERSON} groups`);
        redeem(found.inv, user.id, now);
        addMember(found.group, user.id, now);
        d.invitations = d.invitations.filter(x => !(x && x.group === id && x.to === user.id));
        return id;
      });
      json(res, 200, groupAnswer(store.read(), gid, user.id, date));
    }),

    /* ---------- Friends api m2 ---------- */

    // The group page: the summary, the ring per member, the week's days, targets, moments. Reading
    // settles the week (high-water marks, finished weeks' results; week.js).
    'GET /api/friends/groups/{id}': route(async (req, res) => {
      const user = needUser(req);
      const date = needDate(query(req));
      const d = store.read();
      const { gid, group } = memberGroup(d, req, user.id);
      const detail = groupDetail({ data: d, gid, group, viewer: user.id, date, active: accounts().active, store });
      json(res, 200, { ...groupAnswer(d, gid, user.id, date, detail.summary), ...detail.view });
    }),

    // One member as the caller sees them: only what that person shares. Someone the caller cannot
    // see in the group (not in it, Friends off, a disabled account) answers like an unknown id.
    'GET /api/friends/groups/{id}/members/{uid}': route(async (req, res) => {
      const user = needUser(req);
      const date = needDate(query(req));
      const d = store.read();
      const { gid, group } = memberGroup(d, req, user.id);
      const target = req.friendsParams?.uid;
      if (!isId(target)) NOT_FOUND();
      const out = memberDetail({ data: d, gid, group, viewer: user.id, target, date, active: accounts().active, store });
      if (!out) NOT_FOUND();
      json(res, 200, out);
    }),

    // Hides a moment from everyone in the group. Only someone in it may (either participant of a
    // Trained together), and only one that is there to remove: anything else answers 404. `date`
    // is optional; without it the moment's own date is the day it is looked up on.
    'POST /api/friends/groups/{id}/moments/{mid}/remove': route(async (req, res) => {
      const body = await readBody(req);
      const user = needUser(req);
      onlyKeys(body, []);
      const mid = req.friendsParams?.mid;
      const parsed = parseMomentId(mid);
      if (!parsed || !isDate(parsed.date) || !parsed.who.includes(user.id)) NOT_FOUND();
      const date = optDate(query(req)) || parsed.date;
      const d = store.read();
      const { group } = memberGroup(d, req, user.id);
      const there = groupMoments({ data: d, group, date, active: accounts().active }).some(m => m.id === mid);
      store.mutate(doc => {
        const { group: g } = memberGroup(doc, req, user.id);
        const list = Array.isArray(g.removedMoments) ? g.removedMoments.filter(x => typeof x === 'string') : [];
        if (!there && !list.includes(mid)) NOT_FOUND();
        // Ids of moments past the window are of no use any more; the list stays short.
        const keep = addDays(date, -(MOMENT_DAYS + 7));
        g.removedMoments = [...new Set([...list, mid])].filter(x => (parseMomentId(x)?.date || '') >= keep);
      });
      json(res, 200, { ok: true });
    }),

    /* ---------- Friends api m3 ---------- */
    ...cheerRoutes({ json, readBody, readSession, users, store, route }),
    ...challengeRoutes({ json, readBody, readSession, users, store, route })
  };
}
