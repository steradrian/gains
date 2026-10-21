import { useEffect } from 'react'
import Icon from '../Icon.jsx'
import { fmtDate, todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { defaultMeal, nutritionOf, sumNutrition } from '../../lib/nutrition/diary.js'
import { dayName } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useUnits } from '../../lib/nutrition/use-units.js'

/** The drawer's frame for this step (ds/BottomSheet props). */
export const mealFrame = ({ date, mealName, onBack }) => ({
  type: 'auto', title: t('Logging to'), chip: dayName(date) + ' · ' + mealName, onBack, backLabel: t('Back to results'),
})

// Logging to (board Ea8Meal): the four meals with what each holds on that day, and the day. A pick
// is this drawer's target and, when the drawer follows the shared selection, holds for the next
// half hour (diary selection MEAL_PICK_MS); a drawer opened for a given day (`holds` false) keeps
// the pick to itself and does not say it holds.
export default function LogMealStep({ date, meal, names, setMeal, settings, holds, onPicked }) {
  const units = useUnits()
  const entry = useNutrition(s => s.days[date]?.entry)
  useEffect(() => { useNutrition.getState().loadDay(date) }, [date])
  const clock = date === todayISO() ? defaultMeal(settings) : null
  const kcalIn = slot => Math.round(sumNutrition((entry?.items || []).filter(i => i.meal === slot).map(nutritionOf)).calories || 0)
  const stateOf = slot => {
    const kcal = kcalIn(slot)
    if (kcal > 0) return t('{0} logged', units.energy(kcal))
    return slot === clock ? t('Now, by the clock') : t('Nothing yet')
  }
  return <div className="g-lm">
    <p className="g-lf-note g-lm-note">{holds ? t('Where this sheet logs. Your pick holds for the next half hour.') : t('Where this sheet logs.')}</p>
    <div className="g-lm-list" role="radiogroup" aria-label={t('Meal')}>
      {names.map((name, slot) => (
        <button key={slot} type="button" role="radio" aria-checked={slot === meal} className="g-lm-row" onClick={() => { setMeal(slot); onPicked() }}>
          <span className="g-lm-text"><b>{name}</b><span>{stateOf(slot)}</span></span>
          {slot === meal && <Icon name="check" className="g-icon g-lm-check" />}
        </button>
      ))}
    </div>
    <div className="g-lm-day">
      <span>{t('Day')}</span>
      <b>{date === todayISO() ? `${t('Today')}, ${fmtDate(date, true)}` : fmtDate(date, true)}</b>
    </div>
  </div>
}
