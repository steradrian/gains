// What the Invite page gallery states (me-invite.jsx) show: invites and asks as the admin API lists
// them, dated from now so the rows read "expires Thu 22 Oct" whatever day it is, and an in-memory
// backend with the same four functions the page uses. Nothing here reaches the network, the
// clipboard or storage: a created invite only joins the list in the closure.
const DAY = 86400000
const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * DAY).toISOString()

const invite = (code, rest) => ({ code, note: '', createdBy: 'u_admin', created: iso(-1), expiresAt: iso(6), status: 'valid', ...rest })

export const MARA = invite('A1B2C3D4E5F60718', { name: 'Mara', created: iso(-2), expiresAt: iso(5) })
export const RADU = invite('B2C3D4E5F6071829', { name: 'Radu', status: 'used', usedBy: 'u_radu', usedByName: 'Radu', usedAt: iso(-17), created: iso(-20), expiresAt: iso(-6) })
export const IOANA = invite('C3D4E5F607182930', { name: 'Ioana', status: 'used', usedBy: 'u_ioana', usedByName: 'Ioana', usedAt: iso(-32), created: iso(-35), expiresAt: iso(-21) })
export const VLAD = invite('D4E5F60718293041', { name: 'Vlad', status: 'expired', created: iso(-24), expiresAt: iso(-10) })
// An invite made with no name: the row shows "Invite" and the first characters of its code.
export const NAMELESS = invite('E5F6071829304152', { created: iso(-3), expiresAt: iso(4) })

// M5.0: the board's list.
export const BOARD = [MARA, RADU, IOANA, VLAD]

// Members' open asks, as GET /api/admin/invites lists them (oldest first).
export const ASKS = [
  { id: 'ask1', name: 'Dana', note: 'My training partner Andrei', at: iso(-1), by: 'u_dana' },
  { id: 'ask2', name: 'Paul', note: '', at: iso(0), by: 'u_paul' },
]

/**
 * An in-memory backend. `invites` and `requests` are copied. `loadFails`: 'always' or 'once' makes
 * load reject; `loadNever` leaves it pending (the skeleton); `createFails` makes create reject with
 * that message. `deliver` is what a copy or share answers (default 'copied' / 'shared'; null is a
 * copy that failed).
 */
export function memoryBackend({ invites = BOARD, requests = [], inviteOnly = true, loadFails = null, loadNever = false, createFails = null, deliver } = {}) {
  let list = invites.map(i => ({ ...i }))
  let asks = requests.map(r => ({ ...r }))
  let failed = false
  let made = 0
  return {
    load: async () => {
      if (loadNever) return new Promise(() => {})
      if (loadFails === 'always' || (loadFails === 'once' && !failed)) {
        failed = true
        throw new Error('offline')
      }
      return { invites: list.map(i => ({ ...i })), requests: asks.map(r => ({ ...r })), inviteOnly }
    },
    create: async ({ name, requestId }) => {
      if (createFails) throw new Error(createFails)
      made += 1
      const made1 = invite('F0' + String(made).padStart(14, '0'), { created: iso(0), expiresAt: iso(7), ...(name ? { name } : {}) })
      list = [made1, ...list]
      asks = asks.filter(r => r.id !== requestId)
      return made1
    },
    revoke: async code => { list = list.filter(i => i.code !== code) },
    deliver: async (_url, share) => (deliver !== undefined ? deliver : share ? 'shared' : 'copied'),
  }
}
