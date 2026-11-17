import { fmtDate, isoOf } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { codeHint, expiresAtOf, usedAtOf } from '../../../lib/me/invites.js'

// What the Invite page's rows and toast say (boards M5.0 to M5.2), from the server's records. No
// JSX. A name comes from the record; an invite without one is "Invite" with the first characters
// of its code, never the whole code (a list can be screen-shared).

const dayText = ms => fmtDate(isoOf(new Date(ms)), true)
const dayOf = value => {
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isNaN(ms) ? '' : dayText(ms)
}

/** The row's title: the name the invite was made for, else "Invite" and the code's hint. */
export const inviteTitle = invite => invite.name || t('Invite {0}', codeHint(invite.code))

/** Joined: the person who joined, else the name it was made for. */
export const joinedTitle = invite => invite.usedByName || inviteTitle(invite)

/**
 * "Waiting · expires Thu 22 Oct". An invite made a moment ago in this session (`how` is
 * 'copied', 'shared' or 'none') reads "Waiting · created now" and, when the link went somewhere,
 * "link copied" or "link shared".
 */
export function waitingLine(invite, how) {
  const parts = [t('Waiting')]
  if (how) {
    parts.push(t('created now'))
    if (how === 'copied') parts.push(t('link copied'))
    if (how === 'shared') parts.push(t('link shared'))
    return parts.join(' · ')
  }
  const exp = expiresAtOf(invite)
  if (exp != null) parts.push(t('expires {0}', dayText(exp)))
  return parts.join(' · ')
}

/** "Joined Mon 5 Oct"; just "Joined" when the record has no time. */
export function joinedLine(invite) {
  const at = usedAtOf(invite)
  return at == null ? t('Joined') : t('Joined {0}', dayText(at))
}

/** "Expired Mon 12 Oct". */
export function expiredLine(invite) {
  const exp = expiresAtOf(invite)
  return exp == null ? t('Expired') : t('Expired {0}', dayText(exp))
}

/** A member's ask: who asked, and the line under it is their note, else the day they asked. */
export const askTitle = request => request.name || t('A member')
export function askLine(request) {
  if (request.note) return request.note
  const day = dayOf(request.at)
  return day ? t('Asked {0}', day) : t('Asked for an invite')
}

/** The toast after creating. `how` is 'copied', 'shared' or null (copy failed, or the share sheet was closed). */
export function createdMessage(name, how) {
  if (how === 'copied') return name ? t('Invite for {0} created and link copied', name) : t('Invite created and invite link copied')
  if (how === 'shared') return name ? t('Invite for {0} created', name) : t('Invite created')
  return t('Invite created. Copy its invite link from the list.')
}
