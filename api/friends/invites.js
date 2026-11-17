/* Group invites: the one-time, seven-day codes behind a `g/<code>` link and behind an in-app
 * invitation. Kept apart from the routes, like ../invites.js for app invites, so each rule is
 * testable without a server.
 *
 * An invite record (friends.json `invites[code]`): { group, by, created, expiresAt, to?, usedBy?,
 * usedAt?, revoked?, revokedAt? }. `to` binds the code to one account: an in-app invitation's
 * code works for that person only, and to anyone else it is a code that does not exist. A used
 * or revoked invite stays on record so its holder hears "used" or "expired" rather than "never
 * existed"; a group that is deleted takes its invites with it.
 *
 * `usedBy` is bookkeeping and never leaves the server. */
import crypto from 'node:crypto';
import { isMember } from './rules.js';

export const FRIEND_INVITE_TTL_MS = 7 * 86400000;
export const CODE_LENGTH = 10;
// No 0/O, 1/I/L: a code may be read off a screen and typed.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
// Live codes one member may hold for one group; minting past it revokes their oldest.
export const LIVE_CODES_PER_MEMBER = 20;
// A spent code is kept this long after it stopped working, then forgotten.
export const KEEP_SPENT_MS = 30 * 86400000;

/** A path segment as a code: upper-cased when it has the shape of one, else null. */
export function codeOf(raw) {
  if (typeof raw !== 'string') return null;
  const up = raw.toUpperCase();
  return CODE_RE.test(up) ? up : null;
}

/** A fresh code that `taken(code)` does not already name. */
export function newCode(taken = () => false) {
  let code;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  } while (taken(code));
  return code;
}

export function newGroupInvite({ group, by, to, now = Date.now() }) {
  return {
    group, by,
    created: new Date(now).toISOString(),
    expiresAt: new Date(now + FRIEND_INVITE_TTL_MS).toISOString(),
    ...(to ? { to } : {})
  };
}

const used = inv => !!(inv.usedAt || inv.usedBy);

/** 'used' | 'revoked' | 'expired' | 'valid' for the code itself. Expired from the exact moment
 *  `expiresAt` is reached. */
export function codeStatus(inv, now = Date.now()) {
  if (used(inv)) return 'used';
  if (inv.revoked) return 'revoked';
  const exp = Date.parse(inv.expiresAt);
  if (!Number.isFinite(exp) || exp <= now) return 'expired';
  return 'valid';
}

/** What `code` is to `viewer`: null when it names nothing they may know of (no such code, its
 *  group gone, or bound to someone else); else { inv, group, status } with status 'member' when
 *  the viewer is already in the group, whatever the code's own state. */
export function lookupInvite(data, code, viewer, now = Date.now()) {
  if (!code) return null;
  const inv = data.invites[code];
  if (!inv || typeof inv !== 'object') return null;
  if (inv.to && inv.to !== viewer) return null;
  const group = data.groups[inv.group];
  if (!group) return null;
  const status = isMember(group, viewer) ? 'member' : codeStatus(inv, now);
  return { inv, group, status };
}

/** Marks the invite used by `uid`. */
export function redeem(inv, uid, now = Date.now()) {
  inv.usedBy = uid;
  inv.usedAt = new Date(now).toISOString();
}

/** Housekeeping on every mint: codes that stopped working more than KEEP_SPENT_MS ago are
 *  forgotten, and `by`'s live codes for `gid` beyond LIVE_CODES_PER_MEMBER - 1 are revoked,
 *  oldest first, to leave room for the one about to be minted. */
export function tidyInvites(data, gid, by, now = Date.now()) {
  for (const [code, inv] of Object.entries(data.invites)) {
    if (!inv || typeof inv !== 'object') { delete data.invites[code]; continue; }
    const st = codeStatus(inv, now);
    const ended = st === 'used' ? Date.parse(inv.usedAt) : st === 'revoked' ? Date.parse(inv.revokedAt) : st === 'expired' ? Date.parse(inv.expiresAt) : NaN;
    if (st !== 'valid' && (!Number.isFinite(ended) || now - ended > KEEP_SPENT_MS)) delete data.invites[code];
  }
  const mine = Object.values(data.invites)
    .filter(inv => inv.group === gid && inv.by === by && codeStatus(inv, now) === 'valid')
    .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  for (const inv of mine.slice(0, Math.max(0, mine.length - (LIVE_CODES_PER_MEMBER - 1)))) {
    inv.revoked = true;
    inv.revokedAt = new Date(now).toISOString();
  }
  const live = new Set(Object.keys(data.invites));
  data.invitations = data.invitations.filter(x => x && live.has(x.code) && codeStatus(data.invites[x.code], now) === 'valid');
}

/** True when a still-valid in-app invitation of `to` into `gid` exists. */
export const hasOpenInvitation = (data, gid, to, now = Date.now()) =>
  data.invitations.some(x => x && x.group === gid && x.to === to && data.invites[x.code] && codeStatus(data.invites[x.code], now) === 'valid');
