import { t } from '../lib/i18n.js'
import FoodSearch from './FoodSearch.jsx'
import Icon from './Icon.jsx'
import { ItemRow } from './blocks.jsx'
import { portionSheet } from './PortionSheet.jsx'
import { quickKcalSheet } from './QuickKcalSheet.jsx'
import { useFoodPick } from './use-food-pick.js'

// Choosing what to log, inline under a meal on Home, for one date and meal: the shared food search
// (FoodSearch), where a pick logs through useFoodPick. `onLogged` runs once something is logged.
// Out here there is no Log food drawer to hold the steps, so Amount and Quick calories open as
// drawers of their own.
export default function FoodPicker({ date, meal, mealName, autoFocus = false, onLogged }) {
  const target = { date, meal, mealName, onLogged }
  const { pick, quick, showQuick } = useFoodPick(target, {
    amount: (food, pending) => portionSheet({ ...target, food, pending }),
    quick: pending => quickKcalSheet({ ...target, pending }),
  })

  return <FoodSearch onPick={pick} scan={target} savedMeals={target} autoFocus={autoFocus}>
    {showQuick && <ItemRow className="food-row fp-quick" onClick={quick}
      lead={<span className="lrow-i tint-pink"><Icon name="bolt" /></span>}
      title={t('Quick kcal')} subtitle={t('Just a number, no food')} chevron />}
  </FoodSearch>
}
