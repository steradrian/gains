import { t, tn } from '../../lib/i18n.js'
import { energyOf, foodKcal } from '../../lib/nutrition/diary.js'
import { fmtAmount } from '../../lib/nutrition/foods.js'
import { mealKcal, servingsOf } from '../../lib/nutrition/meals.js'
import { categoryLabel, categoryName } from '../../lib/nutrition/settings-lists.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'

// The lines under a name in My foods and its drawers. Every number is said from the record, in the
// person's energy unit; a line the record cannot back is left out.

export const kcalText = (kcal, settings) => {
  const e = energyOf(kcal, settings)
  return `${e.value} ${e.unit}`
}

export const amountText = food => `${fmtAmount(food.portion ?? 100)} ${food.unit || 'g'}`

// The category as Settings > Categories names it, with its label in front while labels are shown.
function categoryText(food, settings) {
  const entry = (settings?.foodCategories || []).find(c => categoryName(c) === food.category)
  const label = categoryLabel(entry)
  return label && settingOf(settings, 'foodsShowLabels') ? `${label} ${food.category}` : food.category
}

/** "Olympus · 170 g · 120 kcal", then the category and notes while Settings > Foods shows them. */
export const foodSubtitle = (food, settings) => [
  food.brand, amountText(food), kcalText(foodKcal(food), settings),
  settingOf(settings, 'foodsShowCategories') && food.category ? categoryText(food, settings) : '',
  settingOf(settings, 'foodsShowNotes') ? food.notes : '',
].filter(Boolean).join(' · ')

/** Favourites first, each group in the order it came in. */
export function splitFavourites(list) {
  return { favourites: list.filter(f => f.favorite), rest: list.filter(f => !f.favorite) }
}

const SUMMARY_FOODS = 3

/** "Oats, milk, banana · 451 kcal" */
export function savedMealSubtitle(meal, settings) {
  const names = (meal.items || []).map(i => i.name).filter(Boolean)
  const shown = names.slice(0, SUMMARY_FOODS).join(', ') + (names.length > SUMMARY_FOODS ? '…' : '')
  return [shown, kcalText(mealKcal(meal), settings)].filter(Boolean).join(' · ')
}

/** "6 servings · 520 kcal each", or, for a recipe of one serving, "Makes 500 g · 230 kcal per serving". */
export function recipeSubtitle(recipe, settings, { makes = false } = {}) {
  const n = servingsOf(recipe)
  const kcal = kcalText(mealKcal(recipe), settings)
  if (n > 1) {
    const servings = tn('{0} serving', '{0} servings', n)
    return `${makes ? t('Makes {0}', servings) : servings} · ${t('{0} each', kcal)}`
  }
  const weight = Number(recipe.portion) > 0 ? amountText(recipe) : ''
  return `${weight ? t('Makes {0}', weight) : tn('{0} serving', '{0} servings', 1)} · ${t('{0} per serving', kcal)}`
}
