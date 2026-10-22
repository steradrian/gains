import { cheerOf } from '../../../lib/friends/use-cheers.js'
import { GROUP, GROUP_QUIET, ME_ON } from './friends-fixture.js'

// The mock of Friends surfaces m1 (the Today card, Cheers for you, the cheer and invite
// notifications), on top of friends-fixture.js. In memory only; nothing here is ever mutated.

const HOUR = 3600000
const ago = ms => new Date(Date.now() - ms).toISOString()

const workout = (id, name, title) => ({ id, kind: 'workout', names: [name], title })
const best = (id, name) => ({ id, kind: 'best', names: [name] })

/** GET /me with one new moment in Iron Sunday: Mara finished Legs. */
export const ME_NEW_ONE = {
  ...ME_ON, newCount: 1,
  newest: { group: GROUP.id, at: ago(HOUR), moments: [workout('m-legs', 'Mara', 'Legs')] },
}

/** Two new moments: Mara finished Legs, Radu set a new best. */
export const ME_NEW_TWO = {
  ...ME_ON, newCount: 2,
  newest: { group: GROUP.id, at: ago(HOUR), moments: [workout('m-legs', 'Mara', 'Legs'), best('m-best', 'Radu')] },
}

/** The same, with the newest already cheered by this person (what the server says after a cheer). */
export const ME_NEW_CHEERED = {
  ...ME_NEW_TWO,
  newest: { ...ME_NEW_TWO.newest, moments: [{ ...ME_NEW_TWO.newest.moments[0], cheered: true }, ME_NEW_TWO.newest.moments[1]] },
}

/** Nothing new since the person last looked: no card. */
export const ME_NOTHING_NEW = ME_ON

// GET /cheers rows (the contract, plus `moment`, `detail` and `streak` for what the line says).
const cheer = (id, uid, name, kind, hoursAgo, extra = {}) => ({
  id, from: { uid, name }, group: { id: GROUP.id, name: GROUP.name }, kind, ref: id, at: ago(hoursAgo * HOUR), ...extra,
})

const MARA = ['u-mara', 'Mara']
const RADU = ['u-radu', 'Radu']

/** Three rows as the board draws them: two moments, then a week that all four others cheered. */
export const CHEERS_WITH_WEEK = [
  cheer('c1', ...MARA, 'moment', 2, { moment: 'workout', label: 'Push A', detail: 'Sunday evening' }),
  cheer('c2', ...RADU, 'moment', 5, { moment: 'best', label: 'Cable fly', detail: '20 kg x 12' }),
  cheer('c3', ...MARA, 'week', 26, { ref: 'week-1', streak: 4 }),
  cheer('c4', ...RADU, 'week', 27, { ref: 'week-1', streak: 4 }),
  cheer('c5', 'u-ioana', 'Ioana', 'week', 28, { ref: 'week-1', streak: 4 }),
  cheer('c6', 'u-vlad', 'Vlad', 'week', 29, { ref: 'week-1', streak: 4 }),
]

/** Only some of the group cheered the week: each is their own row, and no streak line. */
export const CHEERS_PLAIN = [
  CHEERS_WITH_WEEK[0],
  CHEERS_WITH_WEEK[1],
  cheer('c3', ...MARA, 'week', 26, { ref: 'week-1' }),
]

/** Cheers from two groups: each row names its own group. */
export const CHEERS_TWO_GROUPS = [
  CHEERS_WITH_WEEK[0],
  { ...cheer('c7', 'u-adrian-friend', 'Ana', 'moment', 4, { moment: 'workout', label: 'Long run' }), group: { id: GROUP_QUIET.id, name: GROUP_QUIET.name } },
]

// The Notifications states are fixed to the board's Saturday evening so the feed's ids and the
// evening grouping do not depend on when the gallery is opened.
export const NOTIF_NOW = new Date(2026, 9, 17, 21).getTime()
const at = (hh, mm) => new Date(2026, 9, 17, hh, mm).getTime()
const raw = (id, uid, name, hh, mm) => ({
  id, from: { uid, name }, group: { id: GROUP.id, name: GROUP.name }, kind: 'moment', ref: id,
  moment: 'workout', label: 'Push A', at: new Date(at(hh, mm)).toISOString(),
})

/** What feedOf's `friends` takes: three cheers this evening and an invitation and a challenge started. */
export const NOTIF_FRIENDS = {
  cheers: [raw('n1', ...MARA, 19, 20), raw('n2', ...RADU, 20, 5), raw('n3', 'u-ioana', 'Ioana', 20, 30)].map(cheerOf),
  invitations: [{ code: 'K7M2X9QPA4', group: { id: 'g-run-club', name: 'Run Club' }, from: { name: 'Mara' }, at: at(18, 10) }],
  challengeInvites: [{ cid: 'c-three-times', group: { id: GROUP.id, name: GROUP.name }, from: { name: 'Radu' }, at: at(17, 45) }],
}
