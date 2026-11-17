import { useMemo, useSyncExternalStore } from 'react'
import { useStore } from '../store/useStore.js'
import { useColorMode } from './color-mode.js'
import { resolveIntensity, resolveLook } from './stage-look/index.js'

const QUERY = '(prefers-reduced-motion: reduce)'

const subscribe = cb => {
  const mql = window.matchMedia?.(QUERY)
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}
const osReduces = () => !!window.matchMedia?.(QUERY).matches

/**
 * What AppStage draws the look from: `{ look, intensity, motion }`. The look follows the resolved
 * mode when none was chosen. Each value is selected as a primitive, so a store write that touches
 * none of them re-renders nothing. `motion` is false under Reduce motion or the OS setting.
 */
export function useStageLook() {
  const mode = useColorMode()
  const look = useStore(s => resolveLook(s.S.bgLook, mode))
  const intensity = useStore(s => resolveIntensity(s.S.bgIntensity))
  const appReduces = useStore(s => s.S.reduceMotion === true)
  const osReduce = useSyncExternalStore(subscribe, osReduces, () => false)
  const motion = !appReduces && !osReduce
  return useMemo(() => ({ look, intensity, motion }), [look, intensity, motion])
}
