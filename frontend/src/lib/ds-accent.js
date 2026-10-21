// The design system accent preset (ds/StageScreen.jsx) for the person's accent setting. Every
// theme in lib/themes.js is a preset of the design system now, so this is the theme id that
// accentKey resolves, kept under its own name so the callers do not change.
import { accentKey } from './themes.js'

/** The preset for settings `S` in `mode` ('light' or 'dark'): a theme id; an accent never picked is the mode's default. */
export const dsAccentFor = (S, mode) => accentKey(S, mode)
