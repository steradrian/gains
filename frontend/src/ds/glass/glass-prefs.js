// Liquid glass tuning choices for the sprite presenter, which #/dev/glass switches: the cards' pixel ratio
// and where the contact shadow is drawn. The app's GlassHost reads them at mount, so a choice made on the
// dev page holds in the app too. The defaults are the approved look (cards 3x, drawn shadow). Storage can
// throw (private mode, blocked site data): reads fall back to the defaults and writes are best effort.

export const PREFS = Object.freeze({
  cardDpr: { key: 'lg-card-dpr', values: ['3', '2'], fallback: '3' },
  shadow: { key: 'lg-shadow', values: ['shader', 'css'], fallback: 'shader' },
})

// Keys of the M3 device-gate experiment. The gate picked sprites, so a stored 'fixed' pick is dropped (the
// app always draws sprites now) and so is the copy-path choice.
const RETIRED = ['lg-presenter', 'lg-copy']

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

/** Removes the retired device-gate keys (a stored "fixed" presenter included). */
export function migratePrefs() {
  try {
    for (const key of RETIRED) localStorage.removeItem(key)
  } catch { /* nothing stored to migrate */ }
}

/** Every pref, as GlassHost passes them to the engine. */
export function readPrefs() {
  migratePrefs()
  return {
    cardDpr: Number(readPref('cardDpr')),
    shadow: readPref('shadow'),
  }
}
