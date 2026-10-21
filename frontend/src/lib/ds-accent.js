// The design system's accent preset (ds/StageScreen.jsx ACCENTS) for the person's accent setting.
// The app has eight presets and a colour of the user's own; the design system has five hues and
// ink. This maps one onto the other and touches nothing stored: accent.js stays the source of
// truth for what the person chose, and a larger theme system can replace this function later.
import { ACCENTS } from './format.js'
import { CUSTOM, accentKey, accentValue, isGrey } from './accent.js'

// Owner decision 2026-10-21. A preset not listed here (one added later) falls through to the hue
// match, so it still gets the nearest preset instead of nothing.
const MAPPING = [
  ['cobalt', ['sky']],
  ['moss', ['lime']],
  ['tide', ['teal']],
  ['ember', ['orange', 'red', 'gold']],
  ['plum', ['violet', 'pink']],
]
const PRESET = Object.fromEntries(MAPPING.flatMap(([ds, apps]) => apps.map(app => [app, ds])))

/** HSL hue, 0-360, of a '#rrggbb' colour. */
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

// The app presets' own hues, each labelled with the preset it maps to: a colour of the user's
// that sits on a preset lands where that preset does, and the rest go to the nearest one.
const ANCHORS = Object.entries(PRESET).map(([k, ds]) => ({ hue: hueOf(ACCENTS[k]), ds }))

function nearestByHue(hex) {
  const h = hueOf(hex)
  let best = ANCHORS[0]
  for (const a of ANCHORS) if (hueGap(a.hue, h) < hueGap(best.hue, h)) best = a
  return best.ds
}

/**
 * The design system preset for settings `S`: cobalt, moss, ember, tide, plum or ink. Missing or
 * invalid settings are the app's default accent (lime), so moss. A custom colour with little
 * saturation (accent.js isGrey) is ink; any other goes to the nearest preset by hue.
 */
export function dsAccentFor(S) {
  const key = accentKey(S)
  if (key !== CUSTOM) return PRESET[key] ?? nearestByHue(ACCENTS[key])
  const hex = accentValue(S)
  return isGrey(hex) ? 'ink' : nearestByHue(hex)
}
