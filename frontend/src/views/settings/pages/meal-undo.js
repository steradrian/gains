import { t } from '../../../lib/i18n.js'
import { mealsOf } from '../../../lib/nutrition/diary.js'
import { MEAL_NAME_MAX, MEAL_NAMES_MAX } from '../../../lib/nutrition/settings-lists.js'
import { useUI } from '../../../store/useUI.js'
import { restoreList } from './list-undo.js'

export const mealErrorOf = code => ({
  name: t('Give the meal a name of up to {0} characters.', MEAL_NAME_MAX),
  full: t('There can be at most {0} meals.', MEAL_NAMES_MAX),
  last: t('A day needs at least one meal.'),
  slot: t('That meal is not there any more.'),
  stale: t('The meals changed somewhere else. Close this and open it again.'),
})[code]

/**
 * The toast after a meal was deleted: its name and Undo for 8 s. What was logged is filed by a
 * meal's place in the list, so restoring the list restores where it shows.
 */
export function offerMealUndo({ name, before, after }) {
  useUI.getState().toast(t('Deleted {0}', name), {
    action: t('Undo'),
    onAction: () => restoreList('mealNames', before, after, data => mealsOf(data).map(m => m.name)),
  })
}
