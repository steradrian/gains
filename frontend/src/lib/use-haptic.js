// Haptics for a web app. Two platforms, two mechanisms:
//   iOS      has no Vibration API. WebKit plays the system toggle tick when an
//            <input type="checkbox" switch> flips under the user's own finger (a programmatic click
//            stopped counting in iOS 26.5, WebKit #65327), so ds/HapticSwitch lays one invisible
//            inside the control and the tap lands on it. Nothing to call from here.
//   Android  navigator.vibrate, with a pattern per style.
//   desktop  nothing.
// What ticks is ruled elsewhere (docs/handoffs/gains-native-motion-haptics-handback.md): the tap
// itself made something true, with no further question asked. Every site opts in; none is automatic.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export const HAPTIC_PATTERNS = {
  light: 10,
  medium: 20,
  heavy: 50,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [50, 100, 50],
  selection: 5,
}

// iOS Safari, an installed iOS web app, and iPadOS posing as a Mac.
export function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

export const hapticPlatform = () => (isIos() ? 'ios' : isAndroid() ? 'android' : typeof navigator === 'undefined' ? 'unknown' : 'desktop')

// Settings → Haptics. A module-level switch, pushed from the shell like lib/sound.js's setVibrate:
// the controls that tick read it, none of them takes the store as a dependency.
let enabled = true
const listeners = new Set()
export function setHapticsEnabled(on) {
  const next = on !== false
  if (next === enabled) return
  enabled = next
  for (const fn of listeners) fn()
}
export const hapticsEnabled = () => enabled
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
export const useHapticsEnabled = () => useSyncExternalStore(subscribe, hapticsEnabled, () => true)

// Whether this device can tick at all: Settings shows its row only then.
export const hapticsSupported = () => isIos() || (isAndroid() && typeof navigator.vibrate === 'function')

// The Android half, callable from anywhere a tap is being handled (it must run inside the gesture).
export function haptic(style = 'light') {
  if (!enabled || !isAndroid() || typeof navigator.vibrate !== 'function') return
  try { navigator.vibrate(HAPTIC_PATTERNS[style] ?? HAPTIC_PATTERNS.light) } catch { /* a browser that refuses to buzz */ }
}

export function useHaptic() {
  // Worked out after mount so the first client render matches the server's (and the tests').
  const [platform, setPlatform] = useState('unknown')
  useEffect(() => { setPlatform(hapticPlatform()) }, [])
  const trigger = useCallback(style => haptic(style), [])
  return { platform, isSupported: platform === 'ios' || (platform === 'android' && hapticsSupported()), trigger }
}
