import { api } from '../api.js'

// Me > Invite a friend, the member's side of the invite API (api/server.js 'POST /api/invites/request',
// 'GET /api/invites/requests/mine', 'POST /api/invites/request/cancel'). No JSX, no UI.

// What the asker may write. Must equal REQUEST_NOTE_MAX in api/invites.js, which cuts the note.
export const REQUEST_NOTE_MAX = 120

// The server's caps per person: waiting at once, and made in any rolling 24 hours (withdrawn ones
// count). Must equal REQUEST_OPEN_MAX and REQUEST_DAY_MAX in api/invites.js.
export const REQUEST_OPEN_MAX = 3
export const REQUEST_DAY_MAX = 3

/** Asks an admin for an invite. Resolves to the ask's id. Rejects with the API's error (`status`, `data`). */
export async function askAdmin(note) {
  const { id } = await api('/api/invites/request', { method: 'POST', body: JSON.stringify({ note: String(note || '').trim() }) })
  return id
}

/** The caller's open asks, oldest first: `[{ id, note, at }]`. */
export async function myRequests() {
  const d = await api('/api/invites/requests/mine')
  return Array.isArray(d?.requests) ? d.requests : []
}

/** Withdraws an ask. The server answers ok for an id that is already gone. */
export function cancelRequest(id) {
  return api('/api/invites/request/cancel', { method: 'POST', body: JSON.stringify({ id }) })
}
