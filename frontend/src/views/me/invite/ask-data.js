import { fmtDate, fmtDur, isoOf } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { REQUEST_DAY_MAX, REQUEST_OPEN_MAX } from '../../../lib/me/invite-requests.js'

// What the member's Ask an admin page says (boards M5.4, M5.5), from the server's records and
// refusals. No JSX. The copy names no admin: any admin may answer.

/** "Asked Thu 22 Oct"; just "Asked" when the record has no time. `at` is ms or an ISO string. */
export function askedLine(request) {
  const ms = typeof request?.at === 'number' ? request.at : Date.parse(request?.at)
  if (Number.isNaN(ms)) return t('Asked')
  return t('Asked {0}', fmtDate(isoOf(new Date(ms)), true))
}

/** A row's title: the note the member wrote; an ask sent with no note still reads as an ask. */
export const askedTitle = request => request.note || t('Asked for an invite')

/** True when the member has no asks left to make right now (the server's open cap). */
export const atOpenCap = requests => requests.length >= REQUEST_OPEN_MAX

export const openCapLine = () => t('You have {0} open asks. Withdraw one to ask again.', REQUEST_OPEN_MAX)

/**
 * What a failed ask is, for the page: `kind` 'daily' or 'open' (the server's 429 `reason`),
 * 'offline' (no answer from the server: retryable) or 'other'. `retryAfter` is the server's
 * seconds, only for 'daily'.
 */
export function askFailure(error) {
  const status = error?.status
  if (status === 429) {
    const reason = error.data?.reason === 'open' ? 'open' : 'daily'
    const retryAfter = Number(error.data?.retryAfter)
    return { kind: reason, retryAfter: reason === 'daily' && retryAfter > 0 ? retryAfter : null }
  }
  if (status == null) return { kind: 'offline', retryAfter: null }
  return { kind: 'other', retryAfter: null, message: error.message }
}

/** The line under the button for a failed ask. */
export function askFailureText(failure) {
  switch (failure.kind) {
    case 'daily':
      return failure.retryAfter
        ? t('You’ve asked {0} times today. Try again in {1}.', REQUEST_DAY_MAX, fmtDur(Math.max(60, failure.retryAfter) * 1000))
        : t('You’ve asked {0} times today. Try again later.', REQUEST_DAY_MAX)
    case 'open': return openCapLine()
    case 'offline': return t('Couldn’t send your ask. Check your connection and try again.')
    default: return failure.message || t('Couldn’t send your ask.')
  }
}
