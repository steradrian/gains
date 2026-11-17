import BottomSheet from '../ds/BottomSheet.jsx'
import { useUI } from '../store/useUI.js'
import LogQuickStep, { quickFrame } from './log-food/LogQuickStep.jsx'

// Quick calories (board Ea8Quick) as a drawer of its own, for where there is no Log food drawer to
// hold it as a step: the + sheet's Quick kcal tile, the inline picker, a scan that found no energy.
// Props are LogQuickStep's: date, meal, mealName, onLogged, pending, close.
export default function QuickKcalSheet(props) {
  return <BottomSheet {...quickFrame({ date: props.date, mealName: props.mealName })}><LogQuickStep {...props} /></BottomSheet>
}

export function quickKcalSheet(props) {
  useUI.getState().openSheet(close => <QuickKcalSheet {...props} close={close} />, { variant: 'ds' })
}
