import BottomSheet from '../ds/BottomSheet.jsx'
import { useUI } from '../store/useUI.js'
import LogAmountStep, { amountFrame } from './log-food/LogAmountStep.jsx'

// Amount (board Ea8FoodDetail) as a drawer of its own, for where there is no Log food drawer to
// hold it as a step: the inline picker under a meal, a scanned product, a found food. Inside the
// Log food drawer the same LogAmountStep is a step (FoodPickerSheet), not this.
// Props are LogAmountStep's: food, date, meal, mealName, onLogged, pending, close.
export default function PortionSheet(props) {
  return <BottomSheet {...amountFrame({ date: props.date, mealName: props.mealName })}><LogAmountStep {...props} /></BottomSheet>
}

export function portionSheet(props) {
  useUI.getState().openSheet(close => <PortionSheet {...props} close={close} />, { variant: 'ds' })
}
