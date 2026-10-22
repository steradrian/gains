import { useUI } from '../store/useUI.js'
import RecipeLogSheet from './RecipeLogSheet.jsx'
import SavedMealSheet from './SavedMealSheet.jsx'

// A saved meal (Ea4MealDetail) or a recipe (Ea4Servings), opened from My foods and from the search.
export function MealDetailSheet({ id, recipe, close }) {
  return recipe ? <RecipeLogSheet id={id} close={close} /> : <SavedMealSheet id={id} close={close} />
}

/** Opens the drawer over the page. */
export function mealDetailSheet(props) {
  useUI.getState().openSheet(close => <MealDetailSheet {...props} close={close} />, { variant: 'ds' })
}
