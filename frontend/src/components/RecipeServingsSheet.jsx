import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { nutritionOf } from '../lib/nutrition/diary.js'
import { mealKcal } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import BigStepper from '../ds/BigStepper.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import { kcalText, recipeSubtitle } from '../views/my-foods/library-text.js'

const STEP = 0.5

// How many servings of a recipe, then Log (board Ea4Servings): the recipe's name and what a serving
// is, a stepper in half servings, the energy and protein of that amount, Edit (when `onEdit` is
// given) and Log to <meal>. `onLog(servings)` resolves to whether it was logged and tells the person
// when it was not; the drawer then stays, and Log again sends the same entries. `chip` names the
// day and meal it logs to (`mealName` when the caller has no day to name); `onChip` makes it tappable.
export default function RecipeServingsSheet({ recipe, mealName, chip, onChip, onEdit, onLog, busy = false, close }) {
  const settings = useNutrition(s => s.settings.data)
  const [servings, setServings] = useState(1)
  const [working, setWorking] = useState(false)
  const per = nutritionOf({ nutrition: recipe.nutrition })
  const kcal = kcalText(Math.round(mealKcal(recipe) * servings), settings)
  const protein = Math.round((per.proteins || 0) * servings)

  async function log() {
    if (working || busy) return
    setWorking(true)
    if (await onLog(servings)) close()
    else setWorking(false)
  }

  return (
    <BottomSheet title={recipe.name} chip={chip || mealName} onChip={onChip}
      footer={
        <div className="g-mf-acts">
          {onEdit && <Button variant="secondary" onClick={onEdit}>{t('Edit')}</Button>}
          <Button haptic busy={working || busy} onClick={log}>{t('Log to {0}', mealName)}</Button>
        </div>
      }>
      <p className="g-mf-sub">{recipeSubtitle(recipe, settings, { makes: true })}</p>
      <BigStepper label={t('Servings')} value={servings} step={STEP} min={STEP} unit={t('servings')}
        lessLabel={t('Fewer servings')} moreLabel={t('More servings')} onChange={setServings} />
      <p className="g-mf-amount">{t('{0} · P {1} g', kcal, protein)}</p>
    </BottomSheet>
  )
}

/** Opens the drawer over the page. */
export function recipeServingsSheet(props) {
  useUI.getState().openSheet(close => <RecipeServingsSheet {...props} close={close} />, { variant: 'ds' })
}
