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

// Log food (boards T1.4, Ea8*): one drawer for the selected date and meal that is a small stack of
// steps, not a route and not a sheet on a sheet. The drawer keeps its one history entry; the ‹ in
// its header goes back a step.
//   search   results: Recent and your foods, Saved meals and Recipes tabs, a typed search, No match,
//            Offline (log-food/LogSearchStep). Search and tab stay here, so coming back keeps them.
//   amount   how much of a food, then Add to <meal> (LogAmountStep)
//   food     a food in full (LogFoodFullStep); Log goes to Amount
//   meal     Logging to: the meal and the day (LogMealStep)
//   quick    Quick calories (LogQuickStep)
// A step is pushed with `push({ kind, ...props })`; Amount with `goAmount(food)`, which also drops
// the steps between it and the results. Each step file exports its body and its `…Frame`, the
// drawer props it needs (title, chip, height, pinned head, foot); this one BottomSheet stays
// mounted across steps, so the frame's motion and focus are not redone on every step.
// The chip names the day and the meal (the meal chosen in `meal`; the date is the one it opened on,
// so a drawer open across midnight still logs to its day). `date` and `meal` (a Day page's past
// day) log there without moving the shared selection. It closes once something is logged, and the
// toast says where.
export default function FoodPickerSheet({ close, date: day = null, meal: slot = null }) {
  const target = useSheetTarget({ date: day, meal: slot })
  const { date, meal, mealName } = target
  const log = { date, meal, mealName, onLogged: close }
  const [stack, setStack] = useState([{ kind: 'search' }])
  const step = stack.at(-1)
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

  const push = next => setStack(a => [...a, next])
  const back = () => setStack(a => (a.length > 1 ? a.slice(0, -1) : a))
  const { pick, add, quick, showQuick, pending, quickPending } = useFoodPick(log, {
    amount: food => goAmount(food),
    quick: () => push({ kind: 'quick' }),
  })
  function goAmount(food) { setStack([{ kind: 'search' }, { kind: 'amount', food }]) }

  const ctx = {
    ...target, log, settings, found, saved, query, setQuery, tab, setTab, searchRef,
    push, back, pick, add, quick, showQuick,
    // No recent foods (a first log): Recent offers your most used foods as suggestions, and Scan leads.
    firstRun: found.foods.status === 'ready' && !found.recents.length,
    resetLimit: () => setLimit(OWN_SHOWN),
    moreOwn: () => setLimit(n => n + OWN_SHOWN),
    scan: () => scanSheet(log),
    createFood: name => leaveTo(close, newFoodPath, name ? { prefill: { name } } : undefined),
  }
  const framed = { date, mealName, onBack: back }

  let frame, body
  if (step.kind === 'amount') {
    frame = amountFrame(framed)
    body = <LogAmountStep key={step.food.id ?? step.food.client_key ?? step.food.name} food={step.food} {...log} pending={pending} close={close}
      onFull={() => push({ kind: 'food', food: step.food })} />
  } else if (step.kind === 'food') {
    frame = foodFrame(framed)
    body = <LogFoodFullStep food={step.food} settings={settings} onLog={food => goAmount(food)}
      onSave={async food => {
        const savedFood = await useNutrition.getState().saveFood(food)
        useUI.getState().toast(t('Saved to your foods'))
        return savedFood
      }}
      onEdit={food => leaveTo(close, foodEditPath(food.id))} />
  } else if (step.kind === 'meal') {
    frame = mealFrame(framed)
    body = <LogMealStep date={date} meal={meal} names={target.names} setMeal={target.setMeal} settings={settings} holds={!day} onPicked={back} />
  } else if (step.kind === 'quick') {
    frame = quickFrame(framed)
    body = <LogQuickStep {...log} pending={quickPending} close={close} />
  } else {
    frame = searchFrame(ctx)
    body = <LogSearchStep ctx={ctx} />
  }
  return <BottomSheet {...frame}>{body}</BottomSheet>
}

/** Log food, to the shared selection's day and meal, or to `date` (and `meal`) when given. */
export function foodPickerSheet({ date = null, meal = null } = {}) {
  useUI.getState().openSheet(close => <FoodPickerSheet close={close} date={date} meal={meal} />, { variant: 'ds' })
}
