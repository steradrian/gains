import { useMemo, useRef, useState } from 'react'
import Button from '../../ds/Button.jsx'
import ChipGroup from '../../ds/ChipGroup.jsx'
import { t } from '../../lib/i18n.js'
import { atPortion, nutritionOf, unitsFor } from '../../lib/nutrition/diary.js'
import { fmtAmount } from '../../lib/nutrition/foods.js'
import { addedText, dayName, toastLogged, writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import LogStepper from './LogStepper.jsx'
import { useAfterThis } from './use-after-this.js'

const foodKey = food => String(food.id ?? food.client_key ?? food.name)
const stepOf = unit => (unit === 'g' || unit === 'ml' ? 10 : 1)

/** The drawer's frame for this step (ds/BottomSheet props). */
export const amountFrame = ({ date, mealName }) => ({
  type: 'auto', title: t('Log food'), chip: dayName(date) + ' · ' + mealName,
})

// Amount (board Ea8FoodDetail): how much of a food, then Add to <meal>. The serving size steps in
// its unit (the food's own household units first, chips), servings multiply it, and the energy and
// macros of that amount follow as you change it, with what it does to the meal and to the kcal left
// that day when a goal is set. A failed write keeps the step and what is in it; Add again sends the
// same entry, so a save whose answer was lost is not logged twice.
// `pending` ({ uuid, food }): the entry a failed write may still have saved, shared by the steps of
// one picker. For the same food the next log reuses that uuid, so an amount edited after a lost
// answer updates the entry instead of adding a second one. `onFull` opens A food in full.
export default function LogAmountStep({ food, date, meal, mealName, onLogged, pending: shared, close, onFull }) {
  const units = useUnits()
  const settings = useNutrition(s => s.settings.data)
  // Which box the cursor starts in (Profile › Diary & meals › Quantity starts in).
  const startInServings = settingOf(settings, 'diaryDefaultField') !== 'portion'
  const own = useRef({ uuid: null, food: null })
  const pending = shared || own.current
  const [portion, setPortion] = useState(Number(food.portion) || 100)
  const [unit, setUnit] = useState(food.unit || 'g')
  const [servings, setServings] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // One draft per amount: the same inputs retry the same entry.
  const draft = useMemo(() => {
    try {
      const d = useNutrition.getState().draftFood({ food, meal, portion, unit, servings })
      return pending.uuid && pending.food === foodKey(food) ? { ...d, item: { ...d.item, uuid: pending.uuid } } : d
    } catch { return null }
  }, [food, meal, portion, unit, servings, pending])
  const scaled = nutritionOf({ ...atPortion(food, portion || food.portion, unit), quantity: servings || 1 })
  const after = useAfterThis({ date, meal, mealName, kcal: draft ? Math.round(scaled.calories || 0) : NaN })
  const step = stepOf(unit)
  const macro = (label, v) => <div className="g-la-macro"><b>{fmtAmount(v || 0)} g</b><span>{label}</span></div>

  const log = async () => {
    if (!draft || busy) return
    setBusy(true)
    setError(null)
    try {
      const item = await useNutrition.getState().logFood(date, draft)
      pending.uuid = null
      pending.food = null
      close()
      if (onLogged) onLogged()
      toastLogged(addedText(date, mealName, food.name), () => useNutrition.getState().removeItem(date, item.uuid))
    } catch (e) {
      pending.uuid = draft.item.uuid
      pending.food = foodKey(food)
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  return <div className="g-la">
    <div className="g-la-food">
      <b className="g-la-name">{food.name}</b>
      <span className="g-la-sub">
        {[food.brand, typeof food.id === 'number' ? t('your food') : t('Open Food Facts')].filter(Boolean).join(' · ')}
        {onFull && <>{' · '}<button type="button" className="g-la-link" onClick={onFull}>{t('see it in full')}</button></>}
      </span>
    </div>
    <LogStepper label={t('Serving size')} value={portion} onChange={setPortion} step={step} unit={unit} autoFocus={!startInServings}
      lessLabel={t('Less {0}', `${step} ${unit}`)} moreLabel={t('More {0}', `${step} ${unit}`)} />
    <div className="g-la-units">
      <ChipGroup label={t('Unit')} scroll options={unitsFor(food, settings)} value={unit} onChange={setUnit} />
    </div>
    <LogStepper label={t('Servings')} value={servings} onChange={setServings} autoFocus={startInServings}
      lessLabel={t('Fewer servings')} moreLabel={t('More servings')} />
    <div className="g-la-sum" aria-live="polite">
      <b className="g-la-big">{units.energy(scaled.calories || 0)}</b>
      <div className="g-la-macros">
        {macro(t('Protein'), scaled.proteins)}
        {macro(t('Carbs'), scaled.carbohydrates)}
        {macro(t('Fat'), scaled.fat)}
      </div>
    </div>
    {after && <p className="g-la-after">{after}</p>}
    {!draft && <p className="g-lf-note" role="status">{t('Enter an amount above 0.')}</p>}
    {error && <p className="g-lf-note g-lf-err" role="alert">{error}</p>}
    <Button variant="primary" haptic onClick={log} disabled={!draft || busy}>{busy ? t('Saving…') : t('Add to {0}', mealName)}</Button>
  </div>
}
