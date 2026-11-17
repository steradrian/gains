import { useRef } from 'react'
import { asksQuantity, logServing } from '../lib/nutrition/log-serving.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'

/** Logging a picked food to one date and meal. A pick asks how much, or, with Profile › Diary &
 *  meals › Ask for quantity off, logs one serving at the food's own portion. `add` logs one
 *  serving whatever the setting (the + on a result row). `quick` is Quick calories, offered while
 *  `showQuick` (Profile › Diary & meals). `onLogged` runs once something is logged.
 *  `open` is where the asking goes, by the host: `open.amount(food, pending)` (the Log food
 *  drawer's Amount step, or the stand-alone Amount drawer of the inline picker) and
 *  `open.quick(pending)`. Shared by the inline picker (FoodPicker) and the Log food drawer.
 *  `pending` and `quickPending` are the entries a failed write may have saved, for as long as the
 *  picker is open: an amount edited and logged again updates it. */
export function useFoodPick({ date, meal, mealName, onLogged }, open) {
  const settings = useNutrition(s => s.settings.data)
  const pending = useRef({ uuid: null, food: null }).current
  const quickPending = useRef({ uuid: null }).current
  const add = food => logServing(food, { date, meal, mealName, onLogged })
  const pick = food => (asksQuantity(settings) ? open.amount(food, pending) : add(food))
  const quick = () => open.quick(quickPending)
  return { pick, add, quick, showQuick: settingOf(settings, 'showQuickCalories'), pending, quickPending }
}
