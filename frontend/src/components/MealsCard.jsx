import { useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { mealItems } from '../lib/nutrition/diary.js'
import { mealLabels } from '../lib/nutrition/meal-name.js'
import MealRow from './MealRow.jsx'
import ActivityRows from './ActivityRows.jsx'
import { Card } from './blocks.jsx'

// The entry the address asks to be shown (`?find=<uuid>`, a search's Day result): wherever the
// diary renders, its meal opens and the entry flashes. Only on the date the address names, when
// it names one (`?date=`).
export function useFindEntry(date) {
  const params = new URLSearchParams(useLocation().search)
  const find = params.get('find')
  const on = params.get('date')
  return find && (!on || on === date) ? find : null
}

// The day's meals as collapsed rows, then its activity (ia-proposal §2). `day` is useDiaryDay's.
export default function MealsCard({ date, day }) {
  const names = mealLabels(day.settings)
  const find = useFindEntry(date)
  return <Card className="meals-card">
    <h2 className="sr-only">{t('Meals')}</h2>
    {names.map((name, slot) => {
      const items = mealItems(day.entry, slot)
      return <MealRow key={slot} date={date} slot={slot} name={name} items={items} find={items.some(i => i.uuid === find) ? find : null} />
    })}
    <ActivityRows rows={day.activityRows} target={day.target} sum={day.activitySum} policy={day.settings?.manualActivityPolicy} />
  </Card>
}
