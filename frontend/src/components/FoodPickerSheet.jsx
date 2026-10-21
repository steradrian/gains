import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { OWN_SHOWN, useFoodSearch } from '../lib/nutrition/use-food-search.js'
import { useNutrition } from '../lib/nutrition/store.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import LogAmountStep, { amountFrame } from './log-food/LogAmountStep.jsx'
import LogFoodFullStep, { foodFrame } from './log-food/LogFoodFullStep.jsx'
import LogMealStep, { mealFrame } from './log-food/LogMealStep.jsx'
import LogQuickStep, { quickFrame } from './log-food/LogQuickStep.jsx'
import LogSearchStep, { searchFrame } from './log-food/LogSearchStep.jsx'
import { foodEditPath, leaveTo, newFoodPath } from './log-food/leave-drawer.js'
import { useSheetTarget } from './LoggingTo.jsx'
import { scanSheet } from './ScanSheet.jsx'
import { useFoodPick } from './use-food-pick.js'
import { useSavedMeals } from './use-saved-meals.js'

// Log food (boards T1.4, Ea8*): one drawer for the selected date and meal. Its own content is the
// results; every step after it is a sub-panel of the drawer (store/useUI.js openSheet from inside a
// drawer), which owns the ‹ back, Escape, the browser's back and the history entries.
//   results  Recent and your foods, Saved meals and Recipes tabs, a typed search, No match,
//            Offline (log-food/LogSearchStep). Search and tab live here, so coming back keeps them.
//   amount   how much of a food, then Add to <meal> (LogAmountStep); "see it in full" opens
//   food     a food in full (LogFoodFullStep) on top of it; Log there replaces both with Amount
//   meal     Logging to: the meal and the day (LogMealStep)
//   quick    Quick calories (LogQuickStep)
// Each step file exports its body and its `…Frame`, the drawer props it needs (title, chip, pinned
// head, foot). A panel's render is kept as it was opened, so it carries the day and meal of that
// moment, which the panels cannot change while open (only Logging to does, and it closes on pick).
// The chip names the day and the meal (the meal chosen in `meal`; the date is the one it opened on,
// so a drawer open across midnight still logs to its day). `date` and `meal` (a Day page's past
// day) log there without moving the shared selection. It closes once something is logged, and the
// toast says where.
export default function FoodPickerSheet({ close, date: day = null, meal: slot = null }) {
  const target = useSheetTarget({ date: day, meal: slot })
  const { date, meal, mealName } = target
  const log = { date, meal, mealName, onLogged: close }
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('search')
  const [limit, setLimit] = useState(OWN_SHOWN)
  const searchRef = useRef(null)
  // The search opens focused: the drawer stands on the keyboard (lib/sheet-keyboard.js) so Scan and
  // Create a food at its foot stay in reach while the person types.
  const found = useFoodSearch(query, { limit })
  const saved = useSavedMeals({ query: found.query, ...log })
  const settings = useNutrition(s => s.settings.data)
  useEffect(() => { useNutrition.getState().loadSettings() }, [])

  const { pick, add, quick, showQuick } = useFoodPick(log, {
    amount: (food, pending) => openAmount(food, pending),
    quick: pending => openQuick(pending),
  })
  // The `close` a panel is handed closes that panel; `.drawer` closes the whole Log food drawer.
  const panel = render => useUI.getState().openSheet(render, { variant: 'ds' })
  const whole = c => c.drawer ?? c
  const liveSettings = () => useNutrition.getState().settings.data

  function openAmount(food, pending) {
    panel(c => <BottomSheet {...amountFrame({ date, mealName })}>
      <LogAmountStep key={food.id ?? food.client_key ?? food.name} food={food} {...log} pending={pending} close={whole(c)}
        onFull={() => openFood(food, pending, c)} />
    </BottomSheet>)
  }
  // `amount` closes with its panel and the food above it, so Log there lands on one Amount.
  function openFood(food, pending, amount) {
    panel(c => <BottomSheet {...foodFrame({ date, mealName })}>
      <LogFoodFullStep food={food} settings={liveSettings()}
        onLog={next => { amount(); openAmount(next, pending) }}
        onSave={async next => {
          const savedFood = await useNutrition.getState().saveFood(next)
          useUI.getState().toast(t('Saved to your foods'))
          return savedFood
        }}
        onEdit={next => leaveTo(c, foodEditPath(next.id))} />
    </BottomSheet>)
  }
  function openQuick(pending) {
    panel(c => <BottomSheet {...quickFrame({ date, mealName })}>
      <LogQuickStep {...log} pending={pending} close={whole(c)} />
    </BottomSheet>)
  }
  function openMeal() {
    panel(c => <BottomSheet {...mealFrame({ date, mealName })}>
      <LogMealStep date={date} meal={meal} names={target.names} setMeal={target.setMeal} settings={liveSettings()} holds={!day} onPicked={c} />
    </BottomSheet>)
  }

  const ctx = {
    ...target, log, settings, found, saved, query, setQuery, tab, setTab, searchRef,
    openMeal, pick, add, quick, showQuick,
    // No recent foods (a first log): Recent offers your most used foods as suggestions, and Scan leads.
    firstRun: found.foods.status === 'ready' && !found.recents.length,
    resetLimit: () => setLimit(OWN_SHOWN),
    moreOwn: () => setLimit(n => n + OWN_SHOWN),
    scan: () => scanSheet(log),
    createFood: name => leaveTo(close, newFoodPath, name ? { prefill: { name } } : undefined),
  }
  return <BottomSheet {...searchFrame(ctx)}><LogSearchStep ctx={ctx} /></BottomSheet>
}

/** Log food, to the shared selection's day and meal, or to `date` (and `meal`) when given. */
export function foodPickerSheet({ date = null, meal = null } = {}) {
  useUI.getState().openSheet(close => <FoodPickerSheet close={close} date={date} meal={meal} />, { variant: 'ds' })
}
