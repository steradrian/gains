import { api } from './api.js'
import { useStore } from '../store/useStore.js'

// Account deletion's client calls. shell-m2 ships only `cancelDeletion`, which the root's
// "Your account is scheduled for deletion" banner needs; acct-m2 adds scheduling and the passkey
// proof to this file.

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
  try {
    const me = await api('/api/me')
    if (me.user?.id) useStore.getState().setUser(me.user)
  } catch { /* the cancel went through; the next /api/me read brings the user back */ }
  return true
}
