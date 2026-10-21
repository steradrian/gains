import { useRef } from 'react'
import { asksQuantity, logServing } from '../lib/nutrition/log-serving.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { portionSheet } from './PortionSheet.jsx'
import { quickKcalSheet } from './QuickKcalSheet.jsx'

/** Logging a picked food to one date and meal: a pick asks how much (PortionSheet), or, with
 *  Profile › Diary & meals › Ask for quantity off, logs one serving at the food's own portion.
 *  `quick` is the Quick kcal sheet, offered while `showQuick` (Profile › Diary & meals).
 *  `onLogged` runs once something is logged. Shared by the inline picker (FoodPicker) and the
 *  Log food drawer (FoodPickerSheet). */
export function useFoodPick({ date, meal, mealName, onLogged }) {
  const settings = useNutrition(s => s.settings.data)
  // The entry a failed write may have saved, for as long as the picker is open: an amount edited
  // and logged again updates it (PortionSheet, QuickKcalSheet).
  const pending = useRef({ uuid: null, food: null }).current
  const quickPending = useRef({ uuid: null }).current
  const pick = food => (asksQuantity(settings)
    ? portionSheet({ food, date, meal, mealName, onLogged, pending })
    : logServing(food, { date, meal, mealName, onLogged }))
  const quick = () => quickKcalSheet({ date, meal, mealName, onLogged, pending: quickPending })
  return { pick, quick, showQuick: settingOf(settings, 'showQuickCalories') }
}
