// The accent: one of the 25 themes (lib/themes.js), or none picked yet, which follows the mode.
//
// Stored as the synced setting `accent` (a theme id; null, '' or 'auto' when never picked). Ids
// from before the 25 themes, and a stored 'custom' with its `accentCustom` hex, are mapped to a
// theme when read (themes.js migrateAccentId).
//
// Nothing here trusts the stored value: it comes from other devices, backups and the server.
// `accentCustom` is no longer written; it is kept clean because the mapping of an old 'custom'
// still reads it.
export { accentKey, accentLabel, accentPair, applyAccent } from './themes.js'
export { accentKey as accentValue } from './themes.js'

const HEX = /^#[0-9a-f]{6}$/i
// What a stored `accent` may be at all: a short lowercase word. One this version does not know
// (a theme added later) is kept as it is and drawn as "not picked" until the app learns it.
const KEY = /^[a-z][a-z0-9-]{0,23}$/

/** '#rrggbb' in lowercase, or null for anything else ('#abc', 'red', 'url(…)', a number). */
export function cleanHex(v) {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : null
}

/**
 * A copy's accent fields made safe, in place: a malformed `accentCustom` is dropped and an
 * `accent` that is not even a word goes back to not picked. Returns the copy.
 */
export function sanitizeAccent(s) {
  if (!s || typeof s !== 'object') return s
  if ('accentCustom' in s) {
    const hex = cleanHex(s.accentCustom)
    if (hex) s.accentCustom = hex; else delete s.accentCustom
  }
  if ('accent' in s && !(typeof s.accent === 'string' && KEY.test(s.accent))) s.accent = null
  return s
}
