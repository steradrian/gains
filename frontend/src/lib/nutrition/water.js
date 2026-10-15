import { settingOf } from './use-nt-settings.js'

/** The glass a person with no quick-add containers still gets, so water can always be logged. */
export const WATER_STEP_ML = 250

/**
 * The quick-add buttons for water: the containers from Profile › Water (NutriTrace's
 * waterContainers, its two bottles until the list is changed), or one glass when the list is
 * empty. `name` is the container's own name, null for the glass.
 */
export function waterButtons(settings) {
  const list = settingOf(settings, 'waterContainers')
    .filter(c => c && Number(c.volumeMl) > 0)
    .map(c => ({ id: String(c.id), name: c.name, ml: Number(c.volumeMl) }))
  return list.length ? list : [{ id: 'glass', name: null, ml: WATER_STEP_ML }]
}
