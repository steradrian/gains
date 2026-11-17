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

/** Pure, for the web: `notification` is the Notification API where push works here, else null;
 *  `subscribed`, whether this browser holds a push subscription. A page cannot hand a permission
 *  back, so Settings' Push switch turns pushes off by dropping the subscription: allowed without
 *  one is off, as the rest alert reads it (store/useUI.js restAlertsOn). */
export function webPermission({ notification, subscribed = false, ios, installed: home }) {
  if (notification) return notification.permission === 'granted' && subscribed ? 'on' : 'off'
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
  const notification = pushSupported() ? globalThis.Notification : null
  return webPermission({ notification, subscribed: notification?.permission === 'granted' && await pushSubscribed(), ios: isIOS(), installed: installed() })
}

/** Whether this browser holds a push subscription (Settings' Push switch is on). */
export async function pushSubscribed(nav = globalThis.navigator) {
  try {
    const reg = await nav?.serviceWorker?.getRegistration?.()
    return !!(await reg?.pushManager?.getSubscription?.())
  } catch { return false }
}

/** Asks the system where it still can: the phone app's prompt, or a browser that was not asked
 *  yet or was allowed and had Push turned off since (enablePush subscribes it to the server's
 *  pushes, with no prompt when already allowed). Resolves whether it is on now; false when it
 *  could not ask (denied before, iOS not installed), and Reminders has to help. */
export async function requestPermission() {
  if (MOBILE) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    } catch { return false }
  }
  if (!pushSupported() || globalThis.Notification.permission === 'denied') return false
  try { await enablePush(); return true } catch { return false }
}
