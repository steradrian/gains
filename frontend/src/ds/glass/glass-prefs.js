// Liquid glass presenter choice until the M3 device gate (M7 deletes the loser and this file's switch):
// localStorage 'lg-presenter' ('fixed' | 'sprite'), plus the sprite options #/dev/glass tunes. The app's
// GlassHost reads them at mount, so a choice made on the dev page holds in the app too. Storage can throw
// (private mode, blocked site data): reads fall back to the defaults and writes are best effort.

export const PREFS = Object.freeze({
  presenter: { key: 'lg-presenter', values: ['fixed', 'sprite'], fallback: 'fixed' },
  copy: { key: 'lg-copy', values: ['draw2d', 'bitmap'], fallback: 'draw2d' },
  cardDpr: { key: 'lg-card-dpr', values: ['3', '2'], fallback: '3' },
  shadow: { key: 'lg-shadow', values: ['shader', 'css'], fallback: 'shader' },
})

/** One pref's stored value, or its default when it is missing, unknown or storage throws. */
export function readPref(name) {
  const p = PREFS[name]
  try {
    const v = localStorage.getItem(p.key)
    return p.values.includes(v) ? v : p.fallback
  } catch {
    return p.fallback
  }
}

export function writePref(name, value) {
  const p = PREFS[name]
  if (!p.values.includes(String(value))) return
  try { localStorage.setItem(p.key, String(value)) } catch { /* this page keeps the choice in state */ }
}

/** Every pref, as GlassHost passes them to the engine. */
export function readPrefs() {
  return {
    presenter: readPref('presenter'),
    copy: readPref('copy'),
    cardDpr: Number(readPref('cardDpr')),
    shadow: readPref('shadow'),
  }
}
