// An invite is a link, not a bare code: `<server>/join/<code>`, which the hub sends on to the
// app's invite landing (`/#/join/<code>`). The server part is where this copy of the app is
// served from (appBase handles a subpath install); the paired mobile app is served from its own
// shell, so there it is the server it is paired with.
import { appBase } from './app-base.js'
import { remoteServer } from './api.js'
import { MOBILE } from './mobile.js'

export function inviteLink(code, { remote = remoteServer(), loc = location } = {}) {
  const base = remote ? remote.replace(/\/$/, '') + '/' : loc.origin + appBase(loc)
  return base + 'join/' + encodeURIComponent(code)
}

// The system share sheet: the native one in the app shells, navigator.share in browsers that have it.
export const canShareLink = () => MOBILE || typeof navigator.share === 'function'

// Resolves false when the person dismissed the sheet; throws when sharing itself failed.
export async function shareLink(url, title) {
  try {
    if (MOBILE) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, url })
    } else {
      await navigator.share({ title, url })
    }
    return true
  } catch (e) {
    if (e && (e.name === 'AbortError' || /cancel/i.test(e.message || ''))) return false
    throw e
  }
}
