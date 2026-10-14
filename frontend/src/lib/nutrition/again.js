// "Log again": what was logged to a meal on an earlier day, as drafts for another one. A meal
// can be logged again only when every entry in it can: a food of yours (it has an id) or a quick
// entry. A saved meal, a recipe or an online result never saved to your foods cannot be rebuilt
// from the diary row alone, and logging part of a meal while saying it was all of it misleads.
import { mealItems, nutritionOf } from './diary.js'

const isQuick = item => item.type === 'quick_calories'
const isOwnFood = item => !item.is_recipe && !Array.isArray(item._splitItems) && typeof item.food_server_id === 'number'

/** The entries of `meal` on a day, or null when there are none or any cannot be logged again. */
export function againItems(entry, meal) {
  const items = mealItems(entry, meal)
  if (!items.length) return null
  return items.every(i => isQuick(i) || isOwnFood(i)) ? items : null
}

/** The entries' calories, for the row that offers them. */
export const againKcal = items => Math.round(items.reduce((sum, i) => sum + (nutritionOf(i).calories || 0), 0))

/** One draft per entry, for `meal`. `n` is the nutrition store's state (draftFood, draftQuick).
 *  Build them once and send the same ones on a retry. */
export function againDrafts(items, meal, n) {
  return items.map(item => {
    if (isQuick(item)) {
      const { calories, proteins, carbohydrates, fat } = item.nutrition || {}
      return { quick: n.draftQuick({ kcal: calories, name: item.name, proteins, carbohydrates, fat, meal }) }
    }
    const food = { id: item.food_server_id, name: item.name, brand: item.brand || '', portion: item.portion, unit: item.unit, nutrition: item.nutrition, imgUrl: '' }
    return { food: n.draftFood({ food, meal, portion: item.portion, unit: item.unit, servings: item.quantity }) }
  })
}
