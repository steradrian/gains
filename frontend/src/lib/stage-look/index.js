// What the rest of the app needs to know about looks, without loading the shader: the ids, their
// labels, the mode-dependent default and the settings sanitizers (lib/sync-merge.js).
import { t } from '../i18n-core.js'

export const LOOKS = ['plain', 'linen', 'lines', 'florals', 'silk', 'bloom']

// A look nobody picked follows the resolved mode. Change it here, nowhere else.
export const DEFAULT_LOOK_BY_MODE = { dark: 'bloom', light: 'plain' }
export const DEFAULT_INTENSITY = 0.45

export const defaultLook = mode => DEFAULT_LOOK_BY_MODE[mode === 'light' ? 'light' : 'dark']

export const isLook = id => LOOKS.includes(id)

/** The look to draw for a stored `bgLook` (null, undefined, '', 'auto' and junk are not chosen) in `mode`. */
export const resolveLook = (stored, mode) => (isLook(stored) ? stored : defaultLook(mode))

/** A stored `bgIntensity` as a number from 0 to 1; anything else is the default. */
export const resolveIntensity = v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_INTENSITY)

/** The name shown for a look. `plain` is "Classic". */
export function lookLabel(id) {
  switch (id) {
    case 'plain': return t('Classic')
    case 'linen': return t('Linen')
    case 'lines': return t('Lines')
    case 'florals': return t('Florals')
    case 'silk': return t('Silk')
    case 'bloom': return t('Bloom')
    default: return t('Classic')
  }
}

/** Settings from either side of a sync end up in the renderer: only a clean look and intensity stay. */
export function sanitizeStageLook(s) {
  if (!s || typeof s !== 'object') return s
  if ('bgLook' in s && !isLook(s.bgLook)) s.bgLook = null
  if ('bgIntensity' in s) s.bgIntensity = resolveIntensity(s.bgIntensity)
  return s
}
