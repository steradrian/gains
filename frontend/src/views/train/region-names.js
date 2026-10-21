import { dateLocale, t } from '../../lib/i18n.js'

// "Chest, Arms and Legs", in the UI language.
export const andList = names => {
  try { return new Intl.ListFormat(dateLocale(), { type: 'conjunction' }).format(names) } catch { return names.join(', ') }
}
// The names of lib/muscles.js REGIONS. Literal calls, so check-source-strings sees each key (REGIONS
// holds the English). 'Back' alone is already the packs' back button, so the body part has a key of its own.
export const REGION_NAME = { Chest: () => t('Chest'), Back: () => t('Back muscles'), Shoulders: () => t('Shoulders'), Arms: () => t('Arms'), Core: () => t('Core'), Legs: () => t('Legs') }
/** Body parts (lib/muscles.js REGIONS names) as one translated list: "Legs and core". */
export const regionList = names => andList(names.map(n => REGION_NAME[n]()))
