import { todayISO, fmtDate } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { nutritionOf, sumNutrition } from '../../lib/nutrition/diary.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useDiaryDay } from '../../lib/nutrition/use-diary-day.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { dayTargetsOf } from '../../views/shared/food-target.js'

/**
 * The Amount step's line "After this, Lunch is 510 kcal and the 1,240 kcal left today goes to
 * 1,120.", for `kcal` more in `meal` on `date`. Null until that day's numbers are in, and null
 * without a calorie goal for the day (food-target.js dayTargetsOf: never the 2000 stand-in), so
 * the line is only there when it can be true. Judged against that day's target, not today's.
 */
export function useAfterThis({ date, meal, mealName, kcal }) {
  const day = useDiaryDay(date)
  const goalInputs = useNutrition(s => s.goalInputs)
  const activity = useNutrition(s => s.activity[date]) ?? null
  const units = useUnits()
  if (day.status !== 'ready' || !Number.isFinite(kcal)) return null
  const goal = dayTargetsOf({ settings: day.settings, date, goalInputs, activity, tried: true }).kcal
  if (goal == null) return null
  const mealNow = sumNutrition((day.entry?.items || []).filter(i => i.meal === meal).map(nutritionOf)).calories || 0
  const left = goal - day.totals.calories
  const leftAfter = left - kcal
  const when = date === todayISO() ? t('today') : t('on {0}', fmtDate(date, true))
  const mealAfter = units.energy(Math.round(mealNow + kcal))
  return leftAfter >= 0
    ? t('After this, {0} is {1} and the {2} left {3} goes to {4}.', mealName, mealAfter, units.energy(Math.round(left)), when, units.energy(Math.round(leftAfter)))
    : t('After this, {0} is {1} and you are {2} over {3}.', mealName, mealAfter, units.energy(Math.round(-leftAfter)), when)
}
