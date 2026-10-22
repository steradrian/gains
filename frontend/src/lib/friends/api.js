// The Friends client: one wrapper per route of /api/friends (the contract in
// gains-pr09-friends-shared.md), through the same `api()` the Coach calls the server with. Shapes
// are described here and nowhere else; the first builder to touch a field documents it in
// api/openapi.yaml.
//
// Friends needs the server (it reads each member's synced state), so a guest, the demo build and a
// phone with no server hide it: `friendsAvailable()` is false there and every surface stays out of
// sight. It is also false once the server has answered that it does not have the routes.
import { t } from '../i18n.js'
import { todayISO } from '../format.js'
import { api, remoteServer } from '../api.js'
import { DEMO } from '../demo.js'
import { MOBILE } from '../mobile.js'
import { useStore } from '../../store/useStore.js'

/**
 * @typedef {{ training: boolean, consistency: boolean, targets: boolean, bests: boolean }} Share
 * @typedef {{ uid: string, name: string, initial: string }} MemberLite
 * @typedef {{ id: string, name: string, since: string, memberCount: number, members: MemberLite[],
 *   week: { done: number, planned: number }, streak: number, goalLine: string, challengeLine?: string }} GroupSummary
 * @typedef {{ code: string, group: { id: string, name: string }, from: { name: string }, at?: string }} Invitation
 * @typedef {{ cid: string, group: { id: string, name: string }, from: { name: string }, at?: string }} ChallengeInvite
 * @typedef {{ id: string, kind: 'workout'|'together'|'best'|'target', names: string[], uid?: string, title?: string, cheered?: boolean }} NewestMoment
 * @typedef {{ group: string, at: string, moments: NewestMoment[] }} Newest
 * @typedef {{ on: boolean, share: Share, groups: GroupSummary[], invitations: Invitation[], challengeInvites?: ChallengeInvite[], newCount: number, newest?: Newest }} FriendsMe
 */

/** What the server (or the client) refused: `code` is the contract's (`needs-share`, `invite-used`...), `offline` when nothing answered. */
export class FriendsError extends Error {
  constructor(message, { code = 'unknown', status = 0, data = {} } = {}) {
    super(message)
    this.name = 'FriendsError'
    this.code = code
    this.status = status
    this.data = data
  }
}

// Codes that mean "this server has no Friends for you", not "that one request failed".
const MISSING = new Set(['not-paired', 'bad-response'])

/** Maps what `api()` throws (`{ status, data: { error, code } }`, or a code with no status) to a FriendsError. */
export function toFriendsError(e) {
  if (e instanceof FriendsError) return e
  const status = Number(e?.status) || 0
  const data = e?.data && typeof e.data === 'object' ? e.data : {}
  const code = data.code || (MISSING.has(e?.code) ? e.code : status ? 'http-' + status : 'offline')
  return new FriendsError(data.error || e?.message || 'Request failed', { code, status, data })
}

/** True for an error that means nothing answered: the screen keeps its last data and says so. */
export const isOffline = e => e instanceof FriendsError && e.code === 'offline'

/** True for an error that means this server does not do Friends (or this person cannot use it). */
export const isMissing = e => e instanceof FriendsError && (MISSING.has(e.code) || e.status === 404 || e.status === 401)

/** The one line a failed write is toasted as (shared decision 6): never the server's wording. */
export const friendsErrorText = e => {
  switch (e?.code) {
    case 'friends-off': return t('Turn on Friends first.')
    case 'deletion-scheduled': return t("Your account is set to be deleted, so you can't share right now.")
    case 'group-limit': return t("You're in as many groups as Gains allows. Leave one to make room.")
    case 'group-full': return t('That group is full.')
    case 'challenge-limit': return t('This group already has 3 challenges running. Wait for one to finish.')
    case 'rate-limited': return t('Too many tries. Wait a moment and try again.')
    default: return t("Couldn't do that. Try again when you're online.")
  }
}

let serverMissing = false
let override = null

/** The store marks the routes missing (or back) after /me answers; the gallery forces availability. */
export function setServerMissing(v) { serverMissing = !!v }
export function setAvailableOverride(v) { override = v }

/** Whether Friends exists on this device: signed in, not the demo, a server to talk to, and one that has the routes. */
export function friendsAvailable() {
  if (override != null) return override
  if (DEMO || serverMissing) return false
  if (MOBILE && !remoteServer()) return false
  return !!useStore.getState().user
}

const query = params => {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== '')
  return pairs.length ? '?' + pairs.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&') : ''
}
const seg = encodeURIComponent

async function call(method, path, { params = {}, body } = {}) {
  try {
    return await api('/api/friends' + path + query(params), {
      method,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (e) {
    throw toFriendsError(e)
  }
}

const read = (path, params = {}) => call('GET', path, { params: { date: todayISO(), ...params } })

/** @returns {Promise<FriendsMe>} */
export const getMe = () => read('/me')
/** @param {{ on?: boolean, share?: Share }} patch @returns {Promise<FriendsMe>} `on: true` with no stored share is refused `needs-share`. */
export const putMe = patch => call('PUT', '/me', { body: patch })
/** @returns {Promise<GroupSummary[]>} */
export const getGroups = () => read('/groups')
export const createGroup = ({ name, goal }) => call('POST', '/groups', { body: { name, goal } })
export const getGroup = id => read('/groups/' + seg(id))
export const leaveGroup = id => call('POST', '/groups/' + seg(id) + '/leave')
export const removeMember = (id, uid) => call('POST', '/groups/' + seg(id) + '/members/' + seg(uid) + '/remove')
export const setMute = (id, uid, muted) => call('PUT', '/groups/' + seg(id) + '/mutes', { body: { uid, muted } })
export const setGroupPrefs = (id, prefs) => call('PUT', '/groups/' + seg(id) + '/prefs', { body: prefs })
/** @returns {Promise<{ code: string, url: string, expiresAt: string }>} */
export const createInvite = id => call('POST', '/groups/' + seg(id) + '/invites')
/** @returns {Promise<{ uid: string, name: string, since: string }[]>} `since` is YYYY-MM; `group` leaves out that group's members. */
export const findPeople = (q, group) => call('GET', '/people', { params: { q, group } })
export const inviteUser = (id, uid) => call('POST', '/groups/' + seg(id) + '/invites/user', { body: { uid } })
/** @returns {Promise<{ status: 'valid'|'used'|'expired'|'revoked'|'member', group?: { id: string, name: string, memberCount: number, initials: string[] }, from?: { name: string } }>} `group` only for valid and member. */
export const getJoinPreview = code => call('GET', '/join/' + seg(code))
export const joinGroup = code => call('POST', '/join/' + seg(code))
export const getMember = (id, uid) => read('/groups/' + seg(id) + '/members/' + seg(uid))
export const removeMoment = (id, mid) => call('POST', '/groups/' + seg(id) + '/moments/' + seg(mid) + '/remove')
/** @param {{ group: string, kind: 'moment'|'week'|'challenge', ref: string }} body */
export const sendCheer = body => call('POST', '/cheers', { body })
export const undoCheer = body => call('DELETE', '/cheers', { body })
/**
 * This week's cheers for the person, newest first. `seen: true` is the Cheers for you page being
 * opened (it advances the digest's marker on the server); the background refresh behind the
 * Notifications feed leaves it out so a cheer is never marked seen unseen.
 * @param {{ seen?: boolean }} [opts]
 */
export const getCheers = ({ seen = false } = {}) => read('/cheers', seen ? { seen: 1 } : {})
export const createChallenge = (id, body) => call('POST', '/groups/' + seg(id) + '/challenges', { body })
export const getChallenge = (id, cid) => read('/groups/' + seg(id) + '/challenges/' + seg(cid))
export const joinChallenge = (id, cid) => call('POST', '/groups/' + seg(id) + '/challenges/' + seg(cid) + '/join')
export const leaveChallenge = (id, cid) => call('POST', '/groups/' + seg(id) + '/challenges/' + seg(cid) + '/leave')
