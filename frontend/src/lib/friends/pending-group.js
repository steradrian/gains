// A group link opened before signing in (`/#/g/<code>`): the sign-in screen has no router, so the
// code is kept for this tab (sessionStorage) and the app takes the person to the join page once
// they are in. Storage can be refused (private windows): then the link simply has to be opened
// again after signing in, and the sign-in screen still reads the code from the address.
const KEY = 'gains.pendingGroup'
const IN_PATH = /^\/g\/([A-Za-z0-9_-]{6,64})\/?$/

/** The code in a hash-route path (`/g/<code>`), or null. */
export const groupCodeOf = (pathname = '') => pathname.match(IN_PATH)?.[1] ?? null

export function rememberPendingGroup(code) {
  try { sessionStorage.setItem(KEY, code) } catch { /* storage refused: the address still carries it */ }
}

/** The remembered code, or the one in the address right now. */
export function pendingGroupCode() {
  const inAddress = groupCodeOf(String(globalThis.location?.hash || '').replace(/^#/, '').split('?')[0])
  if (inAddress) return inAddress
  try { return sessionStorage.getItem(KEY) || null } catch { return null }
}

/** The remembered code, forgotten as it is read. */
export function takePendingGroup() {
  let code = null
  try {
    code = sessionStorage.getItem(KEY) || null
    sessionStorage.removeItem(KEY)
  } catch { /* nothing kept */ }
  return code
}
