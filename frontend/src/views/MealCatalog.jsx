import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { energyOf, matchesFood } from '../lib/nutrition/diary.js'
import { mealErrorText, mealKcal, servingsOf } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import Icon from '../components/Icon.jsx'
import SubHeader from '../components/SubHeader.jsx'
import { mealDetailSheet } from '../components/MealDetailSheet.jsx'
import { mealEditSheet } from '../components/MealEditSheet.jsx'
import { Button, SearchField } from '../components/ui.jsx'

// Nutrition › Saved meals (`recipes` false) and Nutrition › Recipes (true): NutriTrace's Meals and
// Recipes tabs of its Foods page, each its own page here. Tap one to see what is in it and log it.
export default function MealCatalog({ recipes }) {
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const catalog = useNutrition(s => (recipes ? s.recipes : s.meals))
  const settings = useNutrition(s => s.settings.data)
  const [q, setQ] = useState('')
  const title = recipes ? t('Recipes') : t('Saved meals')
  const icon = recipes ? 'cookingPot' : 'bookOpen'

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    n.loadMeals({ recipes, force: true })
  }, [on, recipes])

  if (!on) {
    return <>
      <SubHeader title={title} />
      <div className="card"><div className="empty">
        <div className="ico"><Icon name={icon} /></div>
        <strong>{recipes ? t('Recipes live in the web app') : t('Saved meals live in the web app')}</strong>
        <div>{t('Sign in on the web app to use them here.')}</div>
      </div></div>
    </>
  }

  const create = () => mealEditSheet({ recipe: recipes, settings })
  const list = catalog.list.filter(m => matchesFood(m, q))

  const row = meal => {
    const kcal = energyOf(mealKcal(meal), settings)
    const sub = recipes
      ? `${tn('{0} serving', '{0} servings', servingsOf(meal))} · ${t('per serving')}`
      : tn('{0} ingredient', '{0} ingredients', meal.items.length)
    return <div key={meal.id} className="item" {...tappable(() => mealDetailSheet({ id: meal.id, recipe: recipes, settings }))}>
      <div className="grow">
        <div className="tt">{meal.name}</div>
        <div className="ss">{sub}</div>
      </div>
      <span className="tag">{kcal.value} {kcal.unit}</span>
      <Icon name="chevronRight" className="chev" />
    </div>
  }

  let body
  if (catalog.status === 'error' && !catalog.list.length) {
    body = <div className="empty" role="alert">
      <div>{mealErrorText(catalog.error)}</div>
      <Button size="sm" variant="tinted" onClick={() => useNutrition.getState().loadMeals({ recipes, force: true })}>{t('Try again')}</Button>
    </div>
  } else if (catalog.status !== 'ready' && !catalog.list.length) {
    body = <div className="empty" role="status">{t('Loading…')}</div>
  } else if (!catalog.list.length) {
    body = <div className="empty">
      <div className="ico"><Icon name={icon} /></div>
      <strong>{recipes ? t('No recipes yet') : t('No saved meals yet')}</strong>
      <div>{recipes ? t('Save a dish with its ingredients and log it by the serving.') : t('Save the foods you eat together and log them in one tap.')}</div>
      <Button size="sm" variant="tinted" icon="plus" onClick={create}>{recipes ? t('New recipe') : t('New meal')}</Button>
    </div>
  } else if (!list.length) {
    body = <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>
  } else {
    body = <div className="list">{list.map(row)}</div>
  }

  return <>
    <SubHeader title={title}
      sub={catalog.status === 'ready' ? (recipes ? tn('{0} recipe', '{0} recipes', catalog.list.length) : tn('{0} meal', '{0} meals', catalog.list.length)) : undefined}
      action={<Button size="sm" variant="tinted" icon="plus" onClick={create}>{t('New')}</Button>} />
    {catalog.list.length > 0 && <SearchField value={q} placeholder={recipes ? t('Search your recipes') : t('Search your meals')} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} />}
    {body}
  </>
}
