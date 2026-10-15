import { useRef } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { toastLogged, writeErrorText } from '../lib/nutrition/log-feedback.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { portionSheet } from './PortionSheet.jsx'
import { quickKcalSheet } from './QuickKcalSheet.jsx'
import FoodSearch from './FoodSearch.jsx'
import Icon from './Icon.jsx'
import { ItemRow } from './blocks.jsx'

const foodKey = food => String(food.id ?? food.client_key ?? food.name)

// Choosing what to log, for one date and meal: the shared food search (FoodSearch), where a pick
// asks how much (PortionSheet), or, with Profile › Diary & meals › Ask for quantity off, logs one
// serving at the food's own portion. Inline under a meal on Home, and inside the Log food sheet.
// `onLogged` runs once something is logged from it.
export default function FoodPicker({ date, meal, mealName, autoFocus = false, onLogged }) {
  const settings = useNutrition(s => s.settings.data)
  // The entry a failed write may have saved, for as long as this picker is open: an amount edited
  // and logged again updates it (PortionSheet, QuickKcalSheet).
  const pending = useRef({ uuid: null, food: null }).current
  const quickPending = useRef({ uuid: null }).current
  // The drafts of foods logged without asking, by food: a tap after a failed write sends the same entry.
  const drafts = useRef(new Map()).current

  const logAtOnce = async food => {
    const n = useNutrition.getState()
    const key = foodKey(food)
    try {
      if (!drafts.has(key)) drafts.set(key, n.draftFood({ food, meal, portion: Number(food.portion) || 100, unit: food.unit || 'g', servings: 1 }))
      const item = await n.logFood(date, drafts.get(key))
      drafts.delete(key)
      if (onLogged) onLogged()
      toastLogged(t('Logged to {0}', mealName), () => useNutrition.getState().removeItem(date, item.uuid))
    } catch (e) {
      useUI.getState().toast(writeErrorText(e))
    }
  }
  const pick = food => (settingOf(settings, 'diaryPromptQuantity') === false
    ? logAtOnce(food)
    : portionSheet({ food, date, meal, mealName, onLogged, pending }))

  return <FoodSearch onPick={pick} scan={{ date, meal, mealName, onLogged }} autoFocus={autoFocus}>
    {settingOf(settings, 'showQuickCalories') && <ItemRow className="food-row fp-quick" onClick={() => quickKcalSheet({ date, meal, mealName, onLogged, pending: quickPending })}
      lead={<span className="lrow-i tint-pink"><Icon name="bolt" /></span>}
      title={t('Quick kcal')} subtitle={t('Just a number, no food')} chevron />}
  </FoodSearch>
}
