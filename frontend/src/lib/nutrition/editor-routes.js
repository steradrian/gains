import { nav, onSheetEntry } from '../nav.js'

// Where the food and saved meal editors live, and how the places that make a food open one.
//
// Prefill contract: `/food/my-foods/foods/new` reads `location.state.prefill`, a food-shaped
// object whose editable fields start the form: { name, brand, barcode, portion, unit, category,
// notes, nutrition } (nutrition per serving, in kcal and grams). Every field is optional. A prefill
// writes nothing by itself: the food is created when the person gives it a name (or edits the
// prefilled one). `/food/my-foods/meals/new` reads `state.prefill` { name, items } the same way.

export const FOODS_LIST = '/food/my-foods?tab=foods'
export const MEALS_LIST = '/food/my-foods?tab=meals'
export const NEW_FOOD_PATH = '/food/my-foods/foods/new'
export const NEW_MEAL_PATH = '/food/my-foods/meals/new'

export const foodEditorPath = id => `/food/my-foods/foods/${id}`
export const mealEditorPath = id => `/food/my-foods/meals/${id}`

// Eat library m3: the recipe editor. `/food/my-foods/recipes/new` reads `state.prefill`
// { name, items, notes, servings } like the saved meal editor; nothing is written until it has a
// name and an ingredient.
export const RECIPES_LIST = '/food/my-foods?tab=recipes'
export const NEW_RECIPE_PATH = '/food/my-foods/recipes/new'
export const recipeEditorPath = id => `/food/my-foods/recipes/${id}`

/** Opens the editor for a new food from a sheet or a plain handler. `close` is the sheet's own
 *  close when there is one: its history entry is taken over by the editor (lib/nav.js). */
export function openNewFood(prefill = {}, close) {
  const replace = !!close && onSheetEntry()
  close?.()
  nav(NEW_FOOD_PATH, { state: { prefill }, ...(replace ? { replace: true } : null) })
}
