import { api } from '../api.js'
import { DEMO } from '../demo.js'

// Me > Invite a friend: the admin's side of the invite API (api/server.js 'GET /api/admin/invites',
// 'POST /api/admin/invites/new', 'POST /api/admin/invites/revoke'). No JSX, no UI.

// How long a new invite lasts. Must equal INVITE_TTL_DAYS in api/invites.js, which sets the
// `expiresAt` every invite carries (invites.test.js reads that file to keep the two together).
export const INVITE_TTL_DAYS = 7

// What the inviter may type as the invitee's name. Must equal INVITE_NAME_MAX in api/invites.js.
export const INVITE_NAME_MAX = 40

/**
 * Whether this build can make invites at all: a signed-in account on a server. A guest has no
 * user, the demo has no server, and a phone kept local has no user either. The page itself is
 * the admin's (InviteRoute); this is the account half of that.
 */
export function canInvite(user, { demo = DEMO } = {}) {
  return !!user && !demo
}

/** The first characters of a code, never the code: a list can be screen-shared (api codeHint). */
export const codeHint = code => (typeof code === 'string' && code ? code.slice(0, 4) + '…' : '')

const timeOf = v => {
  const n = typeof v === 'number' ? v : Date.parse(v)
  return Number.isNaN(n) ? null : n
}

/**
 * `{ invites, requests, inviteOnly }` from the server. `inviteOnly` is false only when the server
 * says so. Rejects with the API's error (its `message`).
 */
export async function loadInvites() {
  const d = await api('/api/admin/invites')
  return {
    invites: Array.isArray(d?.invites) ? d.invites : [],
    requests: Array.isArray(d?.requests) ? d.requests : [],
    inviteOnly: d?.invite_only !== false,
  }
}

/** Makes an invite; resolves to the server's invite record. `requestId` answers a member's ask. */
export async function createInvite({ name, requestId } = {}) {
  const body = {}
  if (name && name.trim()) body.name = name.trim()
  if (requestId) body.requestId = requestId
  const { invite } = await api('/api/admin/invites/new', { method: 'POST', body: JSON.stringify(body) })
  return invite
}

/** Revokes an unused invite. Rejects with the API's error. */
export function revokeInvite(code) {
  return api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
}

/**
 * The list in its three groups. The server's `status` decides: valid is waiting, used is joined,
 * expired is expired (revoked ones it already leaves out). A valid one whose `expiresAt` has
 * passed since the list was loaded moves to expired with `now`. Waiting is newest first, joined by
 * when they joined, expired by when they ran out.
 */
export function groupInvites(invites, now = Date.now()) {
  const waiting = [], joined = [], expired = []
  for (const inv of invites || []) {
    if (!inv || inv.revoked) continue
    const exp = timeOf(inv.expiresAt)
    if (inv.status === 'used' || inv.usedBy) joined.push(inv)
    else if (inv.status === 'expired' || (inv.status === 'valid' && exp != null && exp <= now)) expired.push(inv)
    else if (inv.status === 'valid') waiting.push(inv)
  }
  const desc = key => (a, b) => (timeOf(b[key]) ?? 0) - (timeOf(a[key]) ?? 0)
  waiting.sort(desc('created'))
  joined.sort(desc('usedAt'))
  expired.sort(desc('expiresAt'))
  return { waiting, joined, expired }
}

/** When an invite expires, as ms; null when the record carries no time. */
export const expiresAtOf = invite => timeOf(invite?.expiresAt)

/** When it was used, as ms; null when the record carries no time. */
export const usedAtOf = invite => timeOf(invite?.usedAt)
