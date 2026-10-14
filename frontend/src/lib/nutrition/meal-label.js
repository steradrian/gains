import { t } from '../i18n.js'

// NutriTrace's default meal names are English; a name the person saved shows as saved
// (diary.js mealsOf). Literal t() calls so the string checks see them.
const DEFAULTS = {
  Breakfast: () => t('Breakfast'),
  Lunch: () => t('Lunch'),
  Dinner: () => t('Dinner'),
  Snacks: () => t('Snacks'),
}

/** One entry of mealsOf(settings), as the person reads it. */
export const mealLabel = meal => (meal.isDefault && DEFAULTS[meal.name] ? DEFAULTS[meal.name]() : meal.name)
