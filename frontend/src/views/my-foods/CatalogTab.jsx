import { useEffect, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { matchesFood } from '../../lib/nutrition/diary.js'
import { sortFoods } from '../../lib/nutrition/foods.js'
import { mealLoadErrorText } from '../../lib/nutrition/meals.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { LoadError } from '../../components/blocks.jsx'
import { Loading } from '../../components/Loader.jsx'
import { mealDetailSheet } from '../../components/MealDetailSheet.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StageSearchField from '../../ds/StageSearchField.jsx'
import LibraryList from './LibraryList.jsx'
import LibraryRow from './LibraryRow.jsx'
import { recipeSubtitle, savedMealSubtitle } from './library-text.js'

// The Saved meals tab (`recipes` false, board Ea4Saved) and the Recipes tab (true, Ea4Recipes): a
// search, the list in the order Settings > Foods sets, a note, and for an empty tab one empty state
// with one button. A row opens its drawer (Ea4MealDetail, Ea4Servings), which logs it.
export default function CatalogTab({ recipes, settings, onNew }) {
  const catalog = useNutrition(s => (recipes ? s.recipes : s.meals))
  const [q, setQ] = useState('')

  useEffect(() => { useNutrition.getState().loadMeals({ recipes, force: true }) }, [recipes])

  // The meals and the recipes are two lists on the hub; one that holds the other kind is not shown.
  const all = catalog.list.filter(m => !!m.is_recipe === recipes)
  const list = sortFoods(all.filter(m => matchesFood(m, q)), settingOf(settings, recipes ? 'recipesSort' : 'mealsSort'))

  if (catalog.status === 'error' && !all.length) {
    return <LoadError message={mealLoadErrorText(catalog.error)} onRetry={() => useNutrition.getState().loadMeals({ recipes, force: true })} />
  }
  if (catalog.status !== 'ready' && !all.length) return <Loading />
  if (!all.length) {
    return recipes
      ? <StageEmpty card={false} illustration="plate" title={t('No recipes yet')}
        body={t('Add the ingredients once and Gains works out each serving. Log it like any other food.')}
        action={t('New recipe')} onClick={onNew} />
      : <StageEmpty card={false} illustration="plate" title={t('No saved meals yet')}
        body={t('Choose New saved meal, add the foods you eat together, and log them all in one tap.')}
        action={t('New saved meal')} onClick={onNew} />
  }

  return (
    <>
      <StageSearchField query={q} onChange={setQ} label={recipes ? t('Search your recipes') : t('Search your saved meals')}
        placeholder={recipes ? t('Search your recipes') : t('Search your saved meals')} clearLabel={t('Clear search')} />
      {list.length
        ? <LibraryList>
          {list.map(meal => (
            <LibraryRow key={meal.id} title={meal.name}
              sub={recipes ? recipeSubtitle(meal, settings) : savedMealSubtitle(meal, settings)}
              onClick={() => mealDetailSheet({ id: meal.id, recipe: recipes })} />
          ))}
        </LibraryList>
        : <StageEmpty card={false} illustration="search" title={t('No match')} />}
      <StageNote>
        {recipes
          ? t('Tap a recipe to log servings of it. Edit opens its ingredients.')
          : t('A saved meal logs all its foods in one tap, from here, from Log food or from Again on Eat.')}
      </StageNote>
    </>
  )
}
