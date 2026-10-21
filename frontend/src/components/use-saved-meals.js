import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { energyOf, matchesFood } from '../lib/nutrition/diary.js'
import { asksQuantity } from '../lib/nutrition/log-serving.js'
import { addedText, toastLogged, writeErrorText } from '../lib/nutrition/log-feedback.js'
import { mealDraft, mealKcal, mealLoadErrorText } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { recipeServingsSheet } from './RecipeServingsSheet.jsx'

/**
 * Your saved meals and recipes, matching `query`, to log to `date`/`meal` the way the meal's own
 * sheet does (store.logMeal). A saved meal expands to its ingredients at their saved amounts in
 * one tap, with no prompt, as NutriTrace does. A recipe asks for the servings eaten, or logs one
 * when Profile › Diary & meals › Ask for quantity is off (Foods.svelte). A draft is kept per meal,
 * slot and servings until it is logged, so a tap after a failed write sends the same entries and a
 * save whose answer was lost is not logged twice. One write at a time: `busy` while it is out.
 *   all       the matching meals and recipes
 *   failed    neither loaded (with `errorText`); `retry` asks again
 *   pick      log one (or ask its servings first)
 *   subtitle  what a row says under the name; `kcal` its energy ({ value, unit })
 */
export function useSavedMeals({ query, date, meal: slot, mealName, onLogged }) {
  const meals = useNutrition(s => s.meals)
  const recipes = useNutrition(s => s.recipes)
  const settings = useNutrition(s => s.settings.data)
  const [busy, setBusy] = useState(false)
  const drafts = useRef(new Map()).current
  const working = useRef(false)

  useEffect(() => {
    const n = useNutrition.getState()
    n.loadMeals({ recipes: false })
    n.loadMeals({ recipes: true })
  }, [])

  const all = [...meals.list, ...recipes.list].filter(m => !query || matchesFood(m, query))
  const failed = (meals.status === 'error' && !meals.list.length) || (recipes.status === 'error' && !recipes.list.length)
  const loading = !all.length && (meals.status === 'loading' || recipes.status === 'loading')

  /** @returns {Promise<boolean>} whether it was logged; a failure is a toast. */
  async function log(entry, servings = 1) {
    if (working.current) return false
    working.current = true
    setBusy(true)
    const key = `${entry.is_recipe ? 'r' : 'm'}${entry.id}|${date}|${slot}|${servings}`
    try {
      if (!drafts.has(key)) drafts.set(key, mealDraft(entry, { slot, servings }))
      const items = await useNutrition.getState().logMeal(date, drafts.get(key))
      drafts.delete(key)
      if (onLogged) onLogged()
      toastLogged(addedText(date, mealName, entry.name), () => useNutrition.getState().removeItems(date, items.map(i => i.uuid)))
      return true
    } catch (e) {
      if (e?.code === 'invalid') drafts.delete(key)
      useUI.getState().toast(e?.code === 'invalid' ? t('This meal has no ingredients to log.') : writeErrorText(e))
      return false
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  const pick = entry => {
    if (working.current) return
    if (entry.is_recipe && asksQuantity(settings)) recipeServingsSheet({ recipe: entry, mealName, onLog: servings => log(entry, servings) })
    else log(entry)
  }

  const retry = () => {
    const n = useNutrition.getState()
    n.loadMeals({ recipes: false, force: true })
    n.loadMeals({ recipes: true, force: true })
  }

  return {
    all, failed, loading, busy, pick, retry,
    errorText: failed ? mealLoadErrorText(meals.status === 'error' ? meals.error : recipes.error) : '',
    subtitle: entry => (entry.is_recipe ? t('Recipe · 1 serving') : tn('{0} ingredient', '{0} ingredients', entry.items?.length || 0)),
    kcal: entry => energyOf(mealKcal(entry), settings),
    key: entry => `${entry.is_recipe ? 'r' : 'm'}${entry.id}`,
  }
}
