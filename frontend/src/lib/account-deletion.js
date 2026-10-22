import { api, passkeyAssert, webauthnOK } from './api.js'
import { dateLocale } from './i18n.js'
import { useStore } from '../store/useStore.js'

// Account deletion's client calls (api/server.js accountDeleteRoutes): scheduling it behind a
// proof that the owner is here, and cancelling it during the 7-day grace. While one is pending,
// `user.deletion` is `{ at, requestedAt }` and the store pauses sync (useStore pauseForDeletion).

/** Days between asking and the deletion (the server's grace). */
export const GRACE_DAYS = 7

/**
 * Why a deletion was not scheduled. Nothing was deleted and nothing changed on the server or
 * here, whichever the reason:
 *   'cancelled'   the passkey prompt was closed or called off
 *   'passkey'     the prompt failed on this device
 *   'refused'     the server refused the proof (any 403: wrong or expired passkey, wrong password)
 *   'password'    the profile has no passkey but its password counts: ask for that instead
 *   'no-passkey'  nothing can prove it (no passkey, and passwords do not count here)
 *   'no-webauthn' the profile has passkeys, but this browser cannot use them
 *   'last-admin'  the instance's last admin cannot delete itself
 *   'scheduled'   a deletion is already pending
 *   'locked'      too many tries (429)
 *   'signed-out'  the session is gone (401)
 *   'offline'     no answer at all
 *   'error'       any other answer
 */
export class NotConfirmedError extends Error {
  constructor(reason, cause) {
    super('Account deletion not confirmed: ' + reason)
    this.name = 'NotConfirmedError'
    this.reason = reason
    if (cause) this.cause = cause
  }
}

const CONFLICTS = { 'deletion-scheduled': 'scheduled', 'last-admin': 'last-admin', 'no-passkey': 'no-passkey' }
const serverReason = e => {
  if (e?.status === 403) return 'refused'
  if (e?.status === 409) return CONFLICTS[e.data?.code] || 'error'
  if (e?.status === 429) return 'locked'
  if (e?.status === 401) return 'signed-out'
  if (e?.status == null) return 'offline'
  return 'error'
}

// The account as the server has it now. Used where a request may have gone through although its
// answer was lost, so the screens show a pending deletion that really is one.
// One attempt is awaited, so the caller's answer follows it. When that fails too, it goes on in the
// background with a growing wait, so a lost answer plus a flaky network still ends with the banner
// and the pause instead of waiting for the next edit's 423 or a focus recheck.
export const REFRESH_RETRY_MS = [1500, 4000, 10000, 30000]
let refreshRun = 0
const stopRefreshing = () => { refreshRun++ }

async function readUser() {
  try {
    const me = await api('/api/me')
    const st = useStore.getState()
    if (me?.user?.id && me.user.id === st.user?.id) st.setUser(me.user)
    return true
  } catch { return false }
}

async function refreshUser({ retry = true } = {}) {
  const run = ++refreshRun
  if (await readUser() || !retry) return
  const again = i => {
    if (i >= REFRESH_RETRY_MS.length) return
    setTimeout(async () => {
      if (run !== refreshRun) return
      if (!(await readUser())) again(i + 1)
    }, REFRESH_RETRY_MS[i])
  }
  again(0)
}

/**
 * Step one (POST /api/account/delete/options): what the owner can prove it with. Resolves
 * `{ cid, options, password }` (passkey request options for this profile's passkeys, and whether
 * the password counts too) or `{ password: true }` for a password-only profile. Rejects with a
 * NotConfirmedError: 'last-admin', 'no-passkey', 'scheduled' (the account is read again, so the
 * banner shows), 'locked', 'offline'...
 */
export async function prepareDeletion() {
  try {
    return await api('/api/account/delete/options', { method: 'POST', body: '{}' })
  } catch (e) {
    const reason = serverReason(e)
    if (reason === 'scheduled') await refreshUser()
    throw new NotConfirmedError(reason, e)
  }
}

/**
 * Schedules the deletion (POST /api/account/delete) with a proof made now, for this request only:
 * the passkey prompt on `prepared` options (from prepareDeletion, used once; without them they
 * are asked for first), or `current`, the password, for a profile whose password counts. On
 * success the user carries `deletion` and sync pauses; resolves `{ at, requestedAt }`.
 *
 * Any cancel, throw or refusal rejects with a NotConfirmedError and changes nothing: the request
 * that deletes is never sent without a proof, and a refused proof deletes nothing (the server's
 * rule). With `prepared`, the prompt opens before anything is awaited, so it still counts as the
 * tap's on browsers that ask for one. `signal` calls an open prompt off.
 */
export async function scheduleDeletion({ prepared = null, current = null, signal } = {}) {
  let body
  if (typeof current === 'string') body = { current }
  else {
    const ready = prepared?.options ? prepared : await prepareDeletion()
    if (!ready?.options) throw new NotConfirmedError(ready?.password ? 'password' : 'no-passkey')
    if (!webauthnOK()) throw new NotConfirmedError(ready.password ? 'password' : 'no-webauthn')
    let credential
    try { credential = await passkeyAssert(ready.options, { signal }) }
    catch (e) { throw new NotConfirmedError(e?.name === 'NotAllowedError' || e?.name === 'AbortError' ? 'cancelled' : 'passkey', e) }
    if (signal?.aborted) throw new NotConfirmedError('cancelled')
    body = { cid: ready.cid, credential }
  }
  let res
  try {
    res = await api('/api/account/delete', { method: 'POST', body: JSON.stringify(body) })
  } catch (e) {
    const reason = serverReason(e)
    // Refused or in conflict, the server says nothing changed. Any other failure may have come
    // after the server scheduled it: the account is read again, so the banner tells the truth.
    if (reason !== 'refused' && reason !== 'locked') await refreshUser()
    throw new NotConfirmedError(reason, e)
  }
  if (!res?.ok || typeof res.at !== 'string') {
    await refreshUser()
    throw new NotConfirmedError('error')
  }
  const deletion = { at: res.at, requestedAt: res.requestedAt }
  const st = useStore.getState()
  if (st.user) st.setUser({ ...st.user, deletion })
  return deletion
}

/**
 * Cancels a scheduled deletion (POST /api/account/delete/cancel) and reads the account again, so
 * `user.deletion` is gone and sync resumes. Resolves true once the server has the cancel, false
 * when it could not be reached or refused; nothing is thrown, the caller words it.
 */
export async function cancelDeletion() {
  try {
    await api('/api/account/delete/cancel', { method: 'POST', body: '{}' })
  } catch {
    return false
  }
  // The server confirmed it: the store says so now, without waiting for /api/me (which may fail),
  // and a retry still running from scheduling must not bring the schedule back.
  stopRefreshing()
  const st = useStore.getState()
  if (st.user?.deletion) {
    const { deletion: _gone, ...kept } = st.user
    st.setUser(kept)
  }
  await refreshUser({ retry: false })
  return true
}

/** When a deletion asked for at `now` would happen. */
export const graceEnd = (now = Date.now()) => new Date(now + GRACE_DAYS * 86400000).toISOString()

/** A deletion's day, "Sun 25 Oct", in the app's language ('' for a date that is not one). */
export function deletionDay(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d) } catch { return d.toDateString() }
}
