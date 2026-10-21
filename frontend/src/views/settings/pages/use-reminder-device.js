import { useCallback, useEffect, useState } from 'react'
import { MOBILE } from '../../../lib/mobile.js'
import { pushSupported, pushPermission } from '../../../lib/push.js'
import { needsHomeScreen } from '../../../lib/notifications/permission.js'
import { deviceKind } from './reminder-state.js'

/**
 * Which face the Reminders page shows on this device, read fresh on every render. `recheck`
 * re-reads it (the "check again" buttons); the page also re-reads when the tab comes back to the
 * front, which is where someone returns from the phone's settings or the Home Screen.
 */
export function useReminderDevice() {
  const [, setTick] = useState(0)
  const recheck = useCallback(() => setTick(n => n + 1), [])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState !== 'hidden') recheck() }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [recheck])
  const kind = deviceKind({ mobile: MOBILE, pushOK: pushSupported(), needsHome: needsHomeScreen(), permission: pushPermission() })
  return { kind, recheck }
}
