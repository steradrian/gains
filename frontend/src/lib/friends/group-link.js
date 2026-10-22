// The group link: `<app base>/g/<code>`. It opens this app directly (web/nginx.conf.template sends
// /g/<code> to /#/g/<code>, and the hash route sends it on to the join page), so it works before any
// hub page exists. The base is built the way the app invite's is (lib/invite-link.js): where this
// copy is served from, or the server a paired phone app talks to.
import { appBase } from '../app-base.js'
import { remoteServer } from '../api.js'

// Codes are opaque to the client, so the only check is the alphabet and a sane length; the server
// decides whether the invite is any good (GET /join/{code}).
const CODE = /^[A-Za-z0-9_-]{6,64}$/
const IN_LINK = /(?:\/g\/|\/groups\/join\/)([A-Za-z0-9_-]{6,64})\/?(?:[?#].*)?$/

/** `<base>/g/<code>`. */
export function groupLink(code, { remote = remoteServer(), loc = location } = {}) {
  const base = remote ? remote.replace(/\/$/, '') + '/' : loc.origin + appBase(loc)
  return base + 'g/' + encodeURIComponent(code)
}

/**
 * The invite code in what was pasted: a full group link, a `#/g/<code>` (or the app's own
 * `#/me/groups/join/<code>`) address, or the bare code. Null for anything else.
 */
export function parseGroupLink(text) {
  const s = String(text || '').trim()
  if (!s) return null
  if (CODE.test(s)) return s
  if (!/^(?:https?:\/\/|#?\/)/i.test(s)) return null
  const m = s.match(IN_LINK)
  return m ? m[1] : null
}
