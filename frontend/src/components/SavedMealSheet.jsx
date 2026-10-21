import { useEffect } from 'react'
import { t } from '../lib/i18n.js'
import { nutritionOf } from '../lib/nutrition/diary.js'
import { amountOf, totalOf } from '../lib/nutrition/meals.js'
import { closeThenNav } from '../lib/nav.js'
import { useNutrition } from '../lib/nutrition/store.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import { kcalText } from '../views/my-foods/library-text.js'
import { pickMealSheet } from './LoggingTo.jsx'
import { useLibraryLog } from './use-library-log.js'

// A saved meal (board Ea4MealDetail): what is in it with each amount and its energy, the total and
// the three macros, the day and meal it logs to as the chip, Edit and Log to <meal>. Reads the
// meal from the store, so an edit shows here at once; a meal deleted or synced away closes it.
export default function SavedMealSheet({ id, close }) {
  const meal = useNutrition(s => s.meals.list.find(m => m.id === id))
  const settings = useNutrition(s => s.settings.data)
  const { target, chip, busy, log } = useLibraryLog(meal)

  useEffect(() => { useNutrition.getState().loadSettings() }, [])
  useEffect(() => { if (!meal) close() }, [meal, close])

  if (!meal) return null

  const total = totalOf(meal.items)
  const empty = meal.items.length === 0
  const grams = n => `${Math.round(n || 0)} g`
  async function logIt() {
    if (await log()) close()
  }

  return (
    <BottomSheet title={meal.name} chip={chip} onChip={() => pickMealSheet(target)}
      footer={
        <div className="g-mf-acts">
          <Button variant="secondary" onClick={() => closeThenNav(close, `/food/my-foods/meals/${meal.id}`)}>{t('Edit')}</Button>
          <Button haptic busy={busy} disabled={empty} onClick={logIt}>{t('Log to {0}', target.mealName)}</Button>
        </div>
      }>
      {empty
        ? <p className="g-bs-note">{t('This meal has no ingredients to log.')}</p>
        : <ul className="g-mf-lines">
          {meal.items.map((item, i) => (
            <li key={i}>
              <span className="g-mf-line-name"><b>{item.name}</b><span>{amountOf(item)}</span></span>
              <span className="g-mf-line-kcal">{kcalText(nutritionOf(item).calories || 0, settings)}</span>
            </li>
          ))}
        </ul>}
      <div className="g-mf-total"><b>{kcalText(Math.round(total.calories || 0), settings)}</b></div>
      <div className="g-mf-macros">
        <div><b>{grams(total.proteins)}</b><span>{t('Protein')}</span></div>
        <div><b>{grams(total.carbohydrates)}</b><span>{t('Carbs')}</span></div>
        <div><b>{grams(total.fat)}</b><span>{t('Fat')}</span></div>
      </div>
      {meal.notes && <p className="g-bs-note">{meal.notes}</p>}
    </BottomSheet>
  )
}
