import { BRAND } from '../brand.js'
import { hexToOklch, themeOf } from './themes.js'

// Lightness (OKLCH) above which the status bar icons go dark. The darkest light stage is 0.84, the
// lightest dark one 0.59.
const LIGHT_ABOVE = 0.72

/**
 * The colour of the browser chrome and the status bar. On a tab root it is the top of the stage,
 * which is what sits under the status bar (a light stage gives a light colour). Everywhere else
 * (a pushed page, a drawer, a flow with its own ground) it is the page surface of the mode.
 * index.html's pre-paint script sets the same colours for the defaults before React draws.
 */
export function chromeColor({ accent, mode, onStage }) {
  if (onStage) return themeOf(accent).stage.stage
  return BRAND.themeColor[mode === 'light' ? 'light' : 'dark']
}

/** True when dark status bar icons read on `hex` (and light icons would not). */
export const isLightColor = hex => hexToOklch(hex).L > LIGHT_ABOVE

/** Sets <meta name="theme-color">, creating it if missing; nothing happens when it already holds `hex`. */
export function syncThemeColor(hex) {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if (meta.content !== hex) meta.content = hex
}
