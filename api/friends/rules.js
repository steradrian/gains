/* Friends: the membership rules, kept apart from the routes so every one of them can be tested
 * without a server (the way ../invites.js is). Nothing here reads a file or the clock unless it
 * is handed one; the functions that change a group change the object they are given and nothing
 * else.
 *
 * Join order is the order of `group.members`: a new member is appended, nobody is ever moved.
 * "Longest-standing" is therefore the first member left in that list. */
import crypto from 'node:crypto';

export const GROUP_NAME_MAX = 40;
export const GROUP_CAP = 12;
// How many groups one person may be in at once. The boards draw one; the cap only bounds the file.
export const GROUPS_PER_PERSON = 20;
export const GOAL_KINDS = ['planned', 'number', 'targets'];
export const GOAL_NUMBER_MIN = 1;
export const GOAL_NUMBER_MAX = 200;
export const SHARE_KEYS = ['training', 'consistency', 'targets', 'bests'];

// Ids as this module mints them (base64url) and as db.json holds user ids. A path segment or a
// body field that is anything else names nothing, and is answered like an unknown id.
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const isId = v => typeof v === 'string' && ID_RE.test(v);

/** A typed name: control and invisible format characters out (ZWNJ/ZWJ kept, as in
 *  ../invites.js), whitespace folded, at most GROUP_NAME_MAX characters (code points, so an emoji
 *  is never cut in half). '' for anything that is not a string or ends up empty. */
export function cleanText(v, max = GROUP_NAME_MAX) {
  if (typeof v !== 'string') return '';
  const folded = v
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/(?![‌‍])\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(folded).slice(0, max).join('').trim();
}

/** The group name to store, or null when there is none left after cleaning. */
export function groupName(v) {
  const name = cleanText(v, GROUP_NAME_MAX);
  return name ? name : null;
}

/** `{ kind, n? }` as stored, or null for anything else. `n` belongs to `number` only. */
export function parseGoal(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (!GOAL_KINDS.includes(v.kind)) return null;
  for (const k of Object.keys(v)) if (k !== 'kind' && k !== 'n') return null;
  if (v.kind === 'number') {
    if (!Number.isInteger(v.n) || v.n < GOAL_NUMBER_MIN || v.n > GOAL_NUMBER_MAX) return null;
    return { kind: 'number', n: v.n };
  }
  if (v.n !== undefined && v.n !== null) return null;
  return { kind: v.kind };
}

/** The share switches in a body, merged over `current` (all off when there is none). Null when
 *  the body is not an object of known keys with boolean values. */
export function parseShare(v, current) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const k of SHARE_KEYS) out[k] = current?.[k] === true;
  for (const [k, val] of Object.entries(v)) {
    if (!SHARE_KEYS.includes(k) || typeof val !== 'boolean') return null;
    out[k] = val;
  }
  return out;
}

/** The four switches as the API answers them: off unless stored on. */
export function shareOf(person) {
  const out = {};
  for (const k of SHARE_KEYS) out[k] = person?.share?.[k] === true;
  return out;
}

export const membersOf = group => (Array.isArray(group?.members) ? group.members.filter(m => m && isId(m.uid)) : []);
export const isMember = (group, uid) => membersOf(group).some(m => m.uid === uid);
/** Member ids in join order. */
export const memberOrder = group => membersOf(group).map(m => m.uid);

export const newGroupId = () => crypto.randomBytes(9).toString('base64url');

// A member: `joined` the instant, `joinedOn` the joiner's local date (week.js counts a mid-week
// joiner's food targets from it), stored only when the caller has one.
const memberOf = (uid, now, on) => ({ uid, joined: new Date(now).toISOString(), ...(isDate(on) ? { joinedOn: on } : {}) });

/** A new group with its creator as the first member; `on` is the creator's local date. */
export function newGroup({ id, name, goal, creator, now = Date.now(), on = null }) {
  const at = new Date(now).toISOString();
  return { id, name, goal, created: at, creator, members: [memberOf(creator, now, on)], highWater: {}, removedMoments: [] };
}

/** Appends `uid` at the end of join order; `on` is their local date. */
export function addMember(group, uid, now = Date.now(), on = null) {
  if (!Array.isArray(group.members)) group.members = [];
  group.members.push(memberOf(uid, now, on));
}

// A moment id names its people (api-m2: `<kind>:<date>:<uids>:<ref>`); split on anything an id
// cannot hold, so `u1` never matches inside `u10`.
export const mentions = (mid, uid) => typeof mid === 'string' && mid.split(/[^A-Za-z0-9_-]/).includes(uid);

/**
 * Takes `uid` out of group `gid` in `data` (the friends.json document) and out of everything that
 * hangs off that membership: their place in join order, the creator role (passed to the
 * longest-standing member left), their high-water marks, moments that name them, the mutes they
 * set and the mutes others set on them in this group, their notification prefs for it, the invite
 * links they minted for it (revoked, so the link says so) and the in-app invitations they sent.
 * The last member out deletes the group with its invites and invitations.
 * Returns { removed, deleted }.
 */
export function dropMember(data, gid, uid, now = Date.now()) {
  const group = data.groups[gid];
  if (!group || !isMember(group, uid)) return { removed: false, deleted: false };
  group.members = membersOf(group).filter(m => m.uid !== uid);
  if (group.creator === uid || !isMember(group, group.creator)) group.creator = group.members[0]?.uid ?? null;
  if (group.highWater && typeof group.highWater === 'object') {
    for (const week of Object.values(group.highWater)) if (week && typeof week === 'object') delete week[uid];
  }
  if (Array.isArray(group.removedMoments)) group.removedMoments = group.removedMoments.filter(mid => !mentions(mid, uid));
  const me = data.people[uid];
  if (me) {
    if (me.mutes) delete me.mutes[gid];
    if (me.groupPrefs) delete me.groupPrefs[gid];
  }
  for (const person of Object.values(data.people)) {
    const list = person?.mutes?.[gid];
    if (!Array.isArray(list)) continue;
    const kept = list.filter(x => x !== uid);
    if (kept.length) person.mutes[gid] = kept; else delete person.mutes[gid];
  }
  for (const inv of Object.values(data.invites)) {
    if (inv && inv.group === gid && inv.by === uid && !inv.usedAt && !inv.revoked) {
      inv.revoked = true;
      inv.revokedAt = new Date(now).toISOString();
    }
  }
  data.invitations = data.invitations.filter(x => !(x && x.group === gid && x.from === uid));
  // Friends api m3: out of this group's challenges, and the cheers they sent or got here.
  for (const ch of Object.values(data.challenges || {})) {
    if (!ch || ch.group !== gid) continue;
    if (Array.isArray(ch.joined)) ch.joined = ch.joined.filter(j => j && j.uid !== uid);
    if (ch.creator === uid) ch.creator = null;
  }
  if (Array.isArray(data.cheers)) data.cheers = data.cheers.filter(c => !(c && c.group === gid && (c.from === uid || c.to === uid)));
  if (group.members.length) return { removed: true, deleted: false };
  deleteGroup(data, gid);
  return { removed: true, deleted: true };
}

/** A group and everything that names it: its invites, invitations, and every mute and pref on it. */
export function deleteGroup(data, gid) {
  delete data.groups[gid];
  for (const [code, inv] of Object.entries(data.invites)) if (!inv || inv.group === gid) delete data.invites[code];
  data.invitations = data.invitations.filter(x => x && x.group !== gid);
  for (const [id, ch] of Object.entries(data.challenges || {})) if (!ch || ch.group === gid) delete data.challenges[id];
  if (Array.isArray(data.cheers)) data.cheers = data.cheers.filter(c => c && c.group !== gid);
  for (const person of Object.values(data.people)) {
    if (person?.mutes) delete person.mutes[gid];
    if (person?.groupPrefs) delete person.groupPrefs[gid];
  }
}

/**
 * Removes every trace of `uid` from `data`: every membership (with creator handover and empty
 * groups deleted, as dropMember does), their person record, every invitation to or from them,
 * every invite they minted (revoked, with their id taken off) or were the target of, the id on an
 * invite they used, the cheers they sent or got, and their place in every challenge. The account
 * is gone; nothing of it stays.
 */
export function purgeFromData(data, uid, now = Date.now()) {
  for (const gid of Object.keys(data.groups)) dropMember(data, gid, uid, now);
  delete data.people[uid];
  data.invitations = data.invitations.filter(x => x && x.from !== uid && x.to !== uid);
  for (const [code, inv] of Object.entries(data.invites)) {
    if (!inv) continue;
    if (inv.to === uid) { delete data.invites[code]; continue; }
    if (inv.by === uid) {
      if (!inv.usedAt && !inv.revoked) { inv.revoked = true; inv.revokedAt = new Date(now).toISOString(); }
      delete inv.by;
    }
    if (inv.usedBy === uid) delete inv.usedBy;
  }
  if (Array.isArray(data.cheers)) data.cheers = data.cheers.filter(c => c && c.from !== uid && c.to !== uid);
  // Friends api m3: their challenge participation, in groups that are gone too.
  for (const ch of Object.values(data.challenges || {})) {
    if (!ch) continue;
    if (Array.isArray(ch.joined)) ch.joined = ch.joined.filter(j => j && j.uid !== uid);
    if (ch.creator === uid) ch.creator = null;
  }
}

/** The groups `uid` is in, in the order they joined them. */
export function groupsOf(data, uid) {
  const joinedAt = g => membersOf(g).find(m => m.uid === uid)?.joined || '';
  return Object.values(data.groups)
    .filter(g => g && isMember(g, uid))
    .sort((a, b) => (joinedAt(a) < joinedAt(b) ? -1 : joinedAt(a) > joinedAt(b) ? 1 : 0));
}

/* ---------- dates ---------- */

/** A real calendar date written `YYYY-MM-DD`, 2000 to 2099. */
export function isDate(s) {
  if (typeof s !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** The Monday (`YYYY-MM-DD`) of the Monday-to-Sunday week `date` is in; null for a non-date.
 *  Pure calendar arithmetic on the string: no instant, no time zone. */
export function weekOf(date) {
  if (!isDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

/* ---------- people as other members see them ---------- */

/** The display name from the account (never stored here), '' when there is none. */
export const nameOf = user => (user && typeof user.name === 'string' ? user.name : '');
/** First letter of a name, upper-cased; '' for no name. */
export const initialOf = name => (Array.from(String(name || '').trim())[0] || '').toLocaleUpperCase();

/* ---------- Friends api m2: who shows, who counts ---------- */

/** An account Friends may show: in db.users with an id, and not disabled. Disabling is
 *  reversible, so a disabled account keeps every membership, mute, invite and high-water mark
 *  and is only hidden meanwhile, as a person with Friends off is. Every Friends read (api-m3's
 *  cheers too) goes through this. */
export const isActiveUser = u => !!u && isId(u.id) && !u.disabled;

/** db.users as two maps by id. `accounts` holds every account that exists, a disabled one too:
 *  it keeps its place in a group (against the cap of 12, and as creator). `active` holds the
 *  ones Friends shows. */
export function accountMaps(users) {
  const accounts = new Map(), active = new Map();
  for (const u of users || []) {
    if (!u || !isId(u.id)) continue;
    accounts.set(u.id, u);
    if (isActiveUser(u)) active.set(u.id, u);
  }
  return { accounts, active };
}

/** Whether `uid` counts toward a group's week, whoever asks: an active account with Friends on. */
export const countsIn = (data, uid, active) => active.has(uid) && data?.people?.[uid]?.on === true;

/** Whether `viewer` sees `uid` in a group: someone who counts, or the viewer themselves. */
export const visibleMember = (data, uid, viewer, active) => active.has(uid) && (uid === viewer || countsIn(data, uid, active));

/** The date `n` days after `date` (before, for a negative n), on the string alone. */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
