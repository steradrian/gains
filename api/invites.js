/* Invite codes: who may use one, for how long, and what a stranger holding one may learn.
 *
 * An invite works once and for INVITE_TTL_MS after it was made. "Once" was always the rule
 * (`usedBy`); the expiry is new, and an invite from before it gets one at the first boot that
 * knows about it (migrateInvites): the moment of that boot plus INVITE_TTL_MS, so a code already
 * sent to someone does not stop working the day the server is updated. The lifetime was fourteen
 * days until it became seven; an invite keeps the `expiresAt` it was made with.
 *
 * A revoked invite stays on record (`revoked`, `revokedAt`) instead of being deleted, so the
 * public check can tell its holder "no longer valid" rather than "never existed". The admin list
 * leaves revoked ones out, as it did when revoking deleted them.
 *
 * The public check (GET /api/invites/{code}) is for the invite landing page: before anyone signs
 * up, the app shows who sent the link and whether it still works. It answers the status, the
 * inviter's display name and the name the inviter typed for the person, and nothing else: never
 * the note (the inviter's own label, "for Mum"), who used it, when, or any id. It never uses the
 * invite up. Kept out of server.js so every rule can be tested without a server.
 *
 * Only admins make invites. A member asks for one instead (invite requests, at the end): the ask
 * is stored, admins see it on their Invite page, and the member hears by push when an admin makes
 * the invite for it. Nothing a member is answered says who the admins are. */

// The frontend's copy ("lasts 7 days") mirrors this number; its test notes the two must match.
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 86400000;
// What the inviter may type as the invitee's name; the same cap as a profile name.
export const INVITE_NAME_MAX = 40;
// A code as the server mints them (16 hex characters) or as older servers did (8). Anything a
// path segment could carry beyond that is answered like an unknown code, without a lookup.
export const INVITE_CODE = /^[A-Za-z0-9]{4,64}$/;

const ms = iso => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** 'valid' | 'used' | 'revoked' | 'expired', in that order of precedence after the first. */
export function inviteStatus(inv, now = Date.now()) {
  if (inv.usedBy) return 'used';
  if (inv.revoked) return 'revoked';
  const exp = ms(inv.expiresAt);
  if (exp == null || exp <= now) return 'expired';
  return 'valid';
}

/** The invite `code` names, when it can still be used to sign up; otherwise null. */
export function usableInvite(invites, code, now = Date.now()) {
  const inv = (invites || []).find(i => i.code === code);
  return inv && inviteStatus(inv, now) === 'valid' ? inv : null;
}

/** A new invite record. `name` is optional: what the app prefills as the new profile's name. */
export function newInvite({ code, note, name, createdBy, now = Date.now() }) {
  const created = new Date(now).toISOString();
  const suggested = inviteName(name);
  return {
    code, note, createdBy, created,
    expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    ...(suggested ? { name: suggested } : {})
  };
}

// A name typed by the inviter: control and invisible format characters out (as passkey names,
// passkeys-store.js), whitespace folded, capped. A request's note is cleaned the same way, with its
// own cap.
const cleanText = (v, max) => (typeof v === 'string' ? v : '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/(?![‌‍])\p{Cf}/gu, '')
  .replace(/\s+/g, ' ').trim().slice(0, max);
export const inviteName = v => cleanText(v, INVITE_NAME_MAX);

/** Gives every invite without an expiry one, `now` + INVITE_TTL_MS. True when anything changed. */
export function migrateInvites(invites, now = Date.now()) {
  let changed = false;
  for (const inv of invites || []) {
    if (inv && typeof inv === 'object' && !inv.expiresAt) {
      inv.expiresAt = new Date(now + INVITE_TTL_MS).toISOString();
      changed = true;
    }
  }
  return changed;
}

/** Marks an invite revoked. It stays on record for the public check. */
export function revokeInvite(inv, now = Date.now()) {
  inv.revoked = true;
  inv.revokedAt = new Date(now).toISOString();
}

/**
 * What the invite landing page may know about `code`, or null for a code that names no invite.
 * Names only while the invite can still be used (`users` resolves the inviter's; a deleted
 * inviter is null): a code that is used, revoked or expired opens nothing, so it tells whoever
 * holds it nothing about anyone either, only the status.
 */
export function inviteCheck(invites, users, code, now = Date.now()) {
  if (typeof code !== 'string' || !INVITE_CODE.test(code)) return null;
  const inv = (invites || []).find(i => i.code === code.toUpperCase());
  if (!inv) return null;
  const status = inviteStatus(inv, now);
  if (status !== 'valid') return { status, inviterName: null, suggestedName: null };
  const inviter = (users || []).find(u => u.id === inv.createdBy);
  return {
    status,
    inviterName: inviter && typeof inviter.name === 'string' && inviter.name ? inviter.name : null,
    suggestedName: inv.name || null
  };
}

/** How the audit log names a code that may still be live: enough to tell two apart, never usable. */
export const codeHint = code => (typeof code === 'string' ? `${code.slice(0, 4)}…` : '');

/* ---------- invite requests ----------
 * `db.inviteRequests`: { id, by, note, at, status: 'open' | 'done' | 'cancelled', ... }. `by` is
 * the member who asked. A done one also carries `doneAt`, `doneBy` (the admin) and `inviteCode`
 * (a codeHint, never the code); a cancelled one `cancelledAt`.
 *
 * Every ask pushes to every admin, so asking is capped per person: at most REQUEST_OPEN_MAX
 * waiting at once and REQUEST_DAY_MAX made in any REQUEST_WINDOW_MS, whatever became of them (a
 * withdrawn ask still rang the admins' phones). Answered and withdrawn asks are kept for that
 * window only; an open one stays until it is answered, withdrawn or its asker is deleted. */

export const REQUEST_NOTE_MAX = 120;
export const REQUEST_OPEN_MAX = 3;
export const REQUEST_DAY_MAX = 3;
export const REQUEST_WINDOW_MS = 86400000;

export const requestNote = v => cleanText(v, REQUEST_NOTE_MAX);

const isOpen = r => r && r.status === 'open';

/** Drops answered and withdrawn requests older than the window, in place. True when any went. */
export function pruneRequests(requests, now = Date.now()) {
  const before = requests.length;
  const keep = requests.filter(r => isOpen(r) || (ms(r?.at) ?? 0) > now - REQUEST_WINDOW_MS);
  requests.splice(0, requests.length, ...keep);
  return requests.length !== before;
}

/**
 * `by` asks for an invite. The same note while an identical ask of theirs is still open answers
 * that one (a retried tap is not a second ask, and is not counted). Otherwise the caps, then a new
 * open request is appended to `requests`.
 *   -> { ok: true, request, created }
 *   -> { ok: false, reason: 'daily' | 'open', retryAfter } (seconds)
 * 'daily' wins when both apply: withdrawing an open ask would not let them ask again. 'open' has no
 * moment it lifts by itself (an ask is answered or withdrawn, never timed out), so its retryAfter
 * is a whole window and the copy should not promise a time.
 */
export function askForInvite(requests, { id, by, note, now = Date.now() }) {
  const clean = requestNote(note);
  const mine = requests.filter(r => r && r.by === by);
  const open = mine.filter(isOpen);
  const same = open.find(r => r.note === clean);
  if (same) return { ok: true, request: same, created: false };
  const recent = mine.map(r => ms(r.at)).filter(t => t != null && t > now - REQUEST_WINDOW_MS);
  if (recent.length >= REQUEST_DAY_MAX) {
    const frees = Math.min(...recent) + REQUEST_WINDOW_MS;
    return { ok: false, reason: 'daily', retryAfter: Math.max(1, Math.ceil((frees - now) / 1000)) };
  }
  if (open.length >= REQUEST_OPEN_MAX) return { ok: false, reason: 'open', retryAfter: REQUEST_WINDOW_MS / 1000 };
  const request = { id, by, note: clean, at: new Date(now).toISOString(), status: 'open' };
  requests.push(request);
  return { ok: true, request, created: true };
}

/** The asker's own open requests, oldest first: what GET /api/invites/requests/mine answers. */
export const myRequests = (requests, by) =>
  requests.filter(r => isOpen(r) && r.by === by).map(({ id, note, at }) => ({ id, note, at }));

/**
 * `by` withdraws their own open request `id`. True when it did. Someone else's id, an unknown one
 * and one already answered all change nothing and are told apart from nothing: the route answers
 * the same for each, so a member learns nothing about anyone else's asks.
 */
export function cancelRequest(requests, { id, by, now = Date.now() }) {
  const r = requests.find(x => isOpen(x) && x.id === id && x.by === by);
  if (!r) return false;
  r.status = 'cancelled';
  r.cancelledAt = new Date(now).toISOString();
  return true;
}

/**
 * The open requests for the admin list, oldest first, each with its asker's display name. An
 * asker who is gone or disabled is left out: nobody should be invited on behalf of a locked account.
 */
export function openRequests(requests, users) {
  const out = [];
  for (const r of requests) {
    if (!isOpen(r)) continue;
    const u = (users || []).find(x => x.id === r.by);
    if (!u || u.disabled) continue;
    out.push({ id: r.id, name: typeof u.name === 'string' && u.name ? u.name : null, note: r.note, at: r.at, by: r.by });
  }
  return out;
}

/**
 * Marks open request `id` answered by the invite `code` that `adminId` just made. The request, or
 * null when `id` names no open request (unknown, answered, withdrawn): the invite is made anyway.
 */
export function fulfilRequest(requests, id, { code, adminId, now = Date.now() }) {
  if (typeof id !== 'string' || !id) return null;
  const r = requests.find(x => isOpen(x) && x.id === id);
  if (!r) return null;
  r.status = 'done';
  r.doneAt = new Date(now).toISOString();
  r.doneBy = adminId;
  r.inviteCode = codeHint(code);
  return r;
}
