import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { energyOf, matchesFood } from '../lib/nutrition/diary.js'
import { sortFoods } from '../lib/nutrition/foods.js'
import { mealKcal, mealLoadErrorText, servingsOf } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { EmptyState, ItemRow, LoadError, Tag } from '../components/blocks.jsx'
import { Page } from '../components/layout.jsx'
import { mealDetailSheet } from '../components/MealDetailSheet.jsx'
import { mealEditSheet } from '../components/MealEditSheet.jsx'
import { Button, SearchField } from '../components/ui.jsx'
import { Loading } from '../components/Loader.jsx'

// Nutrition › Saved meals (`recipes` false) and Nutrition › Recipes (true): NutriTrace's Meals and
// Recipes tabs of its Foods page, each its own page here. Tap one to see what is in it and log it.
export default function MealCatalog({ recipes }) {
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const catalog = useNutrition(s => (recipes ? s.recipes : s.meals))
  const settings = useNutrition(s => s.settings.data)
  const [q, setQ] = useState('')
  const title = recipes ? t('Recipes') : t('Saved meals')

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    n.loadMeals({ recipes, force: true })
  }, [on, recipes])

  if (!on) {
    return <Page title={title}>
      <EmptyState illustration="plate" title={recipes ? t('Recipes live in the web app') : t('Saved meals live in the web app')}
        body={t('Sign in on the web app to use them here.')} />
    </Page>
  }

  const create = () => mealEditSheet({ recipe: recipes })
  // The order from Profile › Foods & scanning (Meals order, Recipes order).
  const list = sortFoods(catalog.list.filter(m => matchesFood(m, q)), settingOf(settings, recipes ? 'recipesSort' : 'mealsSort'))

  const row = meal => {
    const kcal = energyOf(mealKcal(meal), settings)
    const sub = recipes
      ? `${tn('{0} serving', '{0} servings', servingsOf(meal))} · ${t('per serving')}`
      : tn('{0} ingredient', '{0} ingredients', meal.items.length)
    return <ItemRow key={meal.id} title={meal.name} subtitle={sub} trailing={<Tag>{kcal.value} {kcal.unit}</Tag>} chevron
      onClick={() => mealDetailSheet({ id: meal.id, recipe: recipes })} />
  }

  let body
  if (catalog.status === 'error' && !catalog.list.length) {
    body = <LoadError message={mealLoadErrorText(catalog.error)} onRetry={() => useNutrition.getState().loadMeals({ recipes, force: true })} />
  } else if (catalog.status !== 'ready' && !catalog.list.length) {
    body = <Loading />
  } else if (!catalog.list.length) {
    body = <EmptyState illustration="plate" title={recipes ? t('No recipes yet') : t('No saved meals yet')}
      body={recipes ? t('Save a dish with its ingredients and log it by the serving.') : t('Save the foods you eat together and log them in one tap.')}
      action={{ label: recipes ? t('New recipe') : t('New meal'), icon: 'plus', onClick: create }} />
  } else if (!list.length) {
    body = <EmptyState illustration="search" title={t('No match')} />
  } else {
    body = <div className="list">{list.map(row)}</div>
  }

  return <Page title={title}
    sub={catalog.status === 'ready' ? (recipes ? tn('{0} recipe', '{0} recipes', catalog.list.length) : tn('{0} meal', '{0} meals', catalog.list.length)) : undefined}
    action={<Button size="sm" variant="tinted" icon="plus" onClick={create}>{t('New')}</Button>}>
    {catalog.list.length > 0 && <SearchField value={q} placeholder={recipes ? t('Search your recipes') : t('Search your meals')} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} />}
    {body}
  </Page>
}
