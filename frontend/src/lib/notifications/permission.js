// Whether this phone will buzz for a notification (PR07 N1.3): 'on'; 'off', when it could once
// allowed (or, on an iPhone, once Gains is on the Home Screen); or 'unsupported', a browser with no
// notifications at all. The inbox fills either way; 'off' is the banner with Turn on.
import { MOBILE } from '../mobile.js'
import { enablePush, pushSupported } from '../push.js'

const isIOS = (nav = globalThis.navigator) =>
  /iPad|iPhone|iPod/.test(nav?.userAgent || '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1)

// A web app added to the Home Screen: the display mode the manifest asks for, or iOS's own flag.
const installed = (win = globalThis) => {
  if (win?.navigator?.standalone === true) return true
  try { return !!win?.matchMedia?.('(display-mode: standalone)')?.matches } catch { return false }
}

/** Pure, for the web: `notification` is the Notification API where push works here, else null. */
export function webPermission({ notification, ios, installed: home }) {
  if (notification) return notification.permission === 'granted' ? 'on' : 'off'
  // iOS Safari has notifications only for a web app on the Home Screen.
  return ios && !home ? 'off' : 'unsupported'
}

/** Whether this is an iPhone browser tab, which can only buzz once Gains is on the Home Screen:
 *  the banner's "add Gains to the Home Screen first" (Sh3PermOff) is said only where it is true. */
export const needsHomeScreen = (win = globalThis) => !MOBILE && isIOS(win?.navigator) && !installed(win)

/** This device's permission, as 'on' | 'off' | 'unsupported'. */
export async function readPermission() {
  if (MOBILE) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.checkPermissions()
      return perm.display === 'granted' ? 'on' : 'off'
    } catch { return 'unsupported' }
  }
  return webPermission({ notification: pushSupported() ? globalThis.Notification : null, ios: isIOS(), installed: installed() })
}

/** Asks the system where it still can: the phone app's prompt, or a browser that has not been
 *  asked yet (which also subscribes it to the server's pushes). Resolves whether it is on now;
 *  false when it could not ask (denied before, iOS not installed), and Reminders has to help. */
export async function requestPermission() {
  if (MOBILE) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    } catch { return false }
  }
  if (!pushSupported() || globalThis.Notification.permission !== 'default') return false
  try { await enablePush(); return true } catch { return false }
}
