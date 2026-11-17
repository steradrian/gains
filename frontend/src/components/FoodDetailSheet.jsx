import BottomSheet from '../ds/BottomSheet.jsx'
import { useUI } from '../store/useUI.js'
import { asksQuantity, logServing } from '../lib/nutrition/log-serving.js'
import LogFoodFullStep, { foodFrame } from './log-food/LogFoodFullStep.jsx'
import { foodEditorPath } from '../lib/nutrition/editor-routes.js'
import { leaveTo } from './log-food/leave-drawer.js'
import { useSheetTarget } from './LoggingTo.jsx'
import { portionSheet } from './PortionSheet.jsx'

// A food in full (board Ea8Food) as a drawer of its own, for where it opens from a list rather
// than from Log food (My foods, search results). The date and meal are the shared selection's,
// taken once when it opens. Log goes to Amount (or logs one serving with Ask for quantity off); a
// food of yours adds Edit, an online result Save as food (`onSave`, throwing on failure).
export function FoodDetailSheet({ food, settings, close, onEdit, onSave }) {
  const { date, meal, mealName } = useSheetTarget()
  const log = { date, meal, mealName }
  return <BottomSheet {...foodFrame({ date, mealName })}>
    <LogFoodFullStep food={food} settings={settings} onSave={onSave}
      onEdit={f => {
        if (!onEdit) { leaveTo(close, foodEditorPath(f.id)); return }
        close()
        onEdit(f)
      }}
      onLog={f => {
        close()
        if (asksQuantity(settings)) portionSheet({ ...log, food: f })
        else logServing(f, log)
      }} />
  </BottomSheet>
}

/** Opens a food's detail over the page. `onEdit` for a food of yours, `onSave` for a result. */
export function foodDetailSheet(opts) {
  useUI.getState().openSheet(close => <FoodDetailSheet {...opts} close={close} />, { variant: 'ds' })
}
