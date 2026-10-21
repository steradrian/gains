// The tabs a search is scoped to: the real tab it was opened on (lib/tab-route.js TABS). Light on
// purpose: the header's pill reads it, outside the overlay's lazy chunk.
import { t } from '../i18n-core.js'
import { BRAND } from '../../brand.js'

export const SEARCH_TABS = ['home', 'train', 'food', 'me']

/** A tab as the search keys it. Me's search was keyed `progress` before it took the real tab's
 *  name; a caller still saying so is read as Me. Anything else unknown searches from Home. */
export const searchTab = tab => (tab === 'progress' ? 'me' : SEARCH_TABS.includes(tab) ? tab : 'home')

/** A group's title: a results section's heading, and the scope chip in the header's field. */
export const groupTitle = g => ({
  features: t('Turned-off features'), pages: t('Pages'), settings: t('Settings'), exercises: t('Exercises'), routines: t('Routines'),
  workouts: t('Workouts'), foods: t('Your foods'), days: t('Days'), online: t('Open Food Facts'),
})[g]

/** What the field says on each tab: Today and Me search everything, Train and Eat say their part. */
export function placeholderFor(tab) {
  const scope = searchTab(tab)
  if (scope === 'train') return t('Search training')
  if (scope === 'food') return t('Search food')
  return t('Search {0}', BRAND.name)
}
