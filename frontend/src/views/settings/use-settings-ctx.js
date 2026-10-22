import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { webauthnOK, IS_ANDROID } from '../../lib/api.js'
import { pushSupported } from '../../lib/push.js'
import { wakeLockSupported } from '../../lib/wakelock.js'
import { baseLang, EXERCISE_NAME_LANGS } from '../../lib/i18n.js'
import { effectiveLang } from '../../lib/default-lang.js'
import { DEMO } from '../../lib/demo.js'
import { MOBILE, isAndroid } from '../../lib/mobile.js'
import { referencedFiles } from '../../lib/media-refs.js'
import { playOnSilentSupported, vibrateSupported } from '../../lib/sound.js'
import { systemReducesMotion } from '../../lib/reduced-motion.js'
import { systemReducesTransparency } from '../../lib/reduced-transparency.js'
import { hapticsSupported } from '../../lib/use-haptic.js'
import { foodOn } from '../../lib/nutrition/food-on.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { passwordOn } from '../../components/PasswordAuth.jsx'

// Running as an installed app (home-screen web app or the phone app): no install tip then.
export const standalone = () => {
  try { return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) } catch { return false }
}

/**
 * What the pages and the search need to know about this device and profile: the `ctx` that
 * settings-pages.js (`pageVisible`, `SEARCH`, `searchSettings`) reads. The root and every page
 * call it for themselves.
 */
export function useSettingsCtx() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  // Name-and-password sign-in, where the instance offers it (#118).
  const config = useStore(s => s.config)
  const pwOn = passwordOn(config)
  // What the app is showing, which for a profile that never picked a language is worked out on
  // this device rather than stored (#303).
  const lang = effectiveLang(S, config)
  const wakeOK = wakeLockSupported()
  const [android, setAndroid] = useState(false)

  useEffect(() => {
    // isAndroid() already answers false off the mobile build; the MOBILE check on top keeps the
    // web bundle from even asking.
    if (!MOBILE) return
    isAndroid().then(setAndroid)
  }, [])

  // Whether any custom exercise has a photo or video: the rows about them only show then.
  const hasMedia = referencedFiles(S).length > 0

  // NutriTrace's settings, through the hub (lib/nutrition): the web app, signed in.
  const nutrition = foodOn(user, S)
  const ntSettings = useNutrition(s => s.settings.data)
  useEffect(() => { if (nutrition) useNutrition.getState().loadSettings() }, [nutrition])

  const canVibrate = vibrateSupported()
  const systemMotion = systemReducesMotion()
  const systemTransparency = systemReducesTransparency()
  return {
    user, mobile: MOBILE, android, demo: DEMO, wakeOK, hasMedia, pwOn, webauthn: webauthnOK(),
    sound: !!S.sound, playOnSilent: playOnSilentSupported(), canVibrate, vibrate: S.vibrate !== false, canHaptic: hapticsSupported(),
    profiles: (S.equipProfiles || []).length > 0, nameLang: EXERCISE_NAME_LANGS.includes(baseLang(lang)),
    pushOK: !MOBILE && pushSupported(), reminderOn: !!S.reminder?.on, nudge: !!S.reminder?.nudge,
    autoBackup: !!S.autoBackup, synced: !!sync, installTip: !MOBILE && !standalone(), androidWeb: IS_ANDROID,
    baseLang: baseLang(lang), systemMotion, systemTransparency,
    nutrition, ntSettings, fastingOn: ntSettings?.fastingEnabled === true,
  }
}
