import { useSyncExternalStore } from 'react'
import { useStore } from '../store/useStore.js'

const QUERY = '(prefers-color-scheme: dark)'

/** 'light' or 'dark' for a stored `theme` ('light', 'dark', or anything else = follow the system). */
export const resolveMode = (theme, systemDark) => theme === 'light' || theme === 'dark' ? theme : (systemDark ? 'dark' : 'light')

const subscribe = cb => {
  const mql = window.matchMedia?.(QUERY)
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}
const systemDark = () => !!window.matchMedia?.(QUERY).matches

/** The resolved mode the page is drawn in, following the setting and, for 'system', the OS. */
export function useColorMode() {
  const theme = useStore(s => s.S.theme)
  const dark = useSyncExternalStore(subscribe, systemDark, () => false)
  return resolveMode(theme, dark)
}
