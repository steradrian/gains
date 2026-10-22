import { OFF_COUNTRIES } from './settings-lists.js'

/** The picker's country for an ISO region ("RO" → "Romania"), or null when it does not offer it. */
export const countryOfRegion = region => {
  const code = String(region || '').toUpperCase()
  return code ? Object.keys(OFF_COUNTRIES).find(name => OFF_COUNTRIES[name] === code) ?? null : null
}

/** The region of a BCP 47 tag ("ro-RO", "en_GB", "zh-Hant-TW"), or '' when it names none. */
export const regionOfLocale = tag => {
  const m = String(tag || '').match(/[-_]([A-Za-z]{2})(?:$|[-_])/)
  return m ? m[1].toUpperCase() : ''
}

/** The Open Food Facts search country a person gets before they pick one: the region of the
 *  device's languages ("ro-RO" → Romania), else World. Gains' profile holds no country, so there is
 *  nothing earlier in the order. A region the picker does not offer is skipped, not guessed. */
export function defaultSearchCountry(languages) {
  const list = languages ?? (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language])
  for (const tag of list) {
    const found = countryOfRegion(regionOfLocale(tag))
    if (found) return found
  }
  return 'World'
}
