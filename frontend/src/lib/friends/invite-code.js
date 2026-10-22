// What the "Join with an invite link" field accepts: the group link a friend sent
// (`<base>/g/<code>`, or the app's own `#/me/groups/join/<code>`) or the bare code. Codes are
// opaque to the client, so the only check is the alphabet and a sane length; the server decides
// whether the invite is any good (GET /join/{code}).
const CODE = /^[A-Za-z0-9_-]{6,64}$/
const IN_LINK = /(?:\/g\/|\/groups\/join\/)([A-Za-z0-9_-]{6,64})\/?(?:[?#].*)?$/

/** The invite code in what was pasted, or null when it is not a group link or a code. */
export function parseInviteInput(text) {
  const s = String(text || '').trim()
  if (!s) return null
  if (CODE.test(s)) return s
  if (!/^(?:https?:\/\/|#?\/)/i.test(s)) return null
  const m = s.match(IN_LINK)
  return m ? m[1] : null
}
