import { useEffect } from 'react'
import { closeThenNav } from '../lib/nav.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { pickMealSheet } from './LoggingTo.jsx'
import RecipeServingsSheet from './RecipeServingsSheet.jsx'
import { useLibraryLog } from './use-library-log.js'

// A recipe opened from My foods (board Ea4Servings): the servings drawer, logging to the day and
// meal the diary had selected when it opened. Reads the recipe from the store, so an edit shows
// at once; a recipe deleted or synced away closes it.
export default function RecipeLogSheet({ id, close }) {
  const recipe = useNutrition(s => s.recipes.list.find(m => m.id === id))
  const { target, chip, busy, log } = useLibraryLog(recipe)

  useEffect(() => { useNutrition.getState().loadSettings() }, [])
  useEffect(() => { if (!recipe) close() }, [recipe, close])

  if (!recipe) return null
  return (
    <RecipeServingsSheet recipe={recipe} mealName={target.mealName} chip={chip} busy={busy} close={close}
      // TODO(sheet-panels): the meal picker is a sheet opened from inside this one
      onChip={() => pickMealSheet(target)}
      onEdit={() => closeThenNav(close, `/food/my-foods/recipes/${recipe.id}`)}
      onLog={log} />
  )
}
