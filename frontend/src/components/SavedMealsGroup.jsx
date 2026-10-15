import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { energyOf, matchesFood } from '../lib/nutrition/diary.js'
import { toastLogged, writeErrorText } from '../lib/nutrition/log-feedback.js'
import { mealDraft, mealKcal, mealLoadErrorText } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { Tag, ItemRow, SectionTitle } from './blocks.jsx'
import { Button } from './ui.jsx'

const SHOWN = 8

// The "Saved meals" group of the Log food picker: your saved meals and recipes, one tap each to
// log them to `date`/`meal`, the same way the meal's own sheet does (store.logMeal: a meal adds
// each ingredient at its saved amount in one write; a recipe adds one serving). A draft is kept
// per meal and slot until it is logged, so a tap after a failed write sends the same entries and
// a save whose answer was lost is not logged twice.
export default function SavedMealsGroup({ query, date, meal: slot, mealName, onLogged }) {
  const meals = useNutrition(s => s.meals)
  const recipes = useNutrition(s => s.recipes)
  const settings = useNutrition(s => s.settings.data)
  const [limit, setLimit] = useState(SHOWN)
  const [busy, setBusy] = useState(false)
  const drafts = useRef(new Map()).current

  useEffect(() => {
    const n = useNutrition.getState()
    n.loadMeals({ recipes: false })
    n.loadMeals({ recipes: true })
  }, [])

  const all = [...meals.list, ...recipes.list].filter(m => !query || matchesFood(m, query))
  const failed = (meals.status === 'error' && !meals.list.length) || (recipes.status === 'error' && !recipes.list.length)
  if (!all.length && !failed) return null

  async function log(entry) {
    if (busy) return
    setBusy(true)
    const key = `${entry.is_recipe ? 'r' : 'm'}${entry.id}|${date}|${slot}`
    try {
      if (!drafts.has(key)) drafts.set(key, mealDraft(entry, { slot }))
      const items = await useNutrition.getState().logMeal(date, drafts.get(key))
      drafts.delete(key)
      if (onLogged) onLogged()
      toastLogged(t('Logged to {0}', mealName), () => useNutrition.getState().removeItems(date, items.map(i => i.uuid)))
    } catch (e) {
      if (e?.code === 'invalid') drafts.delete(key)
      useUI.getState().toast(e?.code === 'invalid' ? t('This meal has no ingredients to log.') : writeErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const row = entry => {
    const kcal = energyOf(mealKcal(entry), settings)
    const sub = entry.is_recipe ? t('Recipe · 1 serving') : tn('{0} ingredient', '{0} ingredients', entry.items?.length || 0)
    return <ItemRow key={`${entry.is_recipe ? 'r' : 'm'}${entry.id}`} className="food-row" title={entry.name} subtitle={sub}
      trailing={<Tag>{kcal.value} {kcal.unit}</Tag>} onClick={busy ? undefined : () => log(entry)} aria-disabled={busy || undefined} />
  }

  return <>
    <SectionTitle>{t('Saved meals')}</SectionTitle>
    {failed && !all.length
      ? <>
        <div className="nt-error small" role="alert">{mealLoadErrorText(meals.status === 'error' ? meals.error : recipes.error)}</div>
        <Button size="sm" variant="tinted" onClick={() => { const n = useNutrition.getState(); n.loadMeals({ recipes: false, force: true }); n.loadMeals({ recipes: true, force: true }) }}>{t('Try again')}</Button>
      </>
      : <div className="list">{all.slice(0, limit).map(row)}</div>}
    {all.length > limit && <Button size="sm" variant="tinted" onClick={() => setLimit(n => n + SHOWN)}>{t('Show more')}</Button>}
  </>
}
