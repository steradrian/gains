import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { mealsOf } from '../../../lib/nutrition/diary.js'
import { mealLabels } from '../../../lib/nutrition/meal-name.js'
import { MEAL_NAME_MAX, moveMeal, removeMeal, setMealName } from '../../../lib/nutrition/settings-lists.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useSheetSave } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import TextField from '../../../ds/TextField.jsx'
import { mealErrorOf, offerMealUndo } from './meal-undo.js'

// Diary and meals → a meal (boards St1MealName, A1.19): rename it, move it up or down, delete it.
// `slot` equal to the number of meals adds a new one. Every change is made over the names as the
// server has them when the button is pressed, and only if the meal is still the one that was
// opened. Only what was typed is saved as the person's: the default names (Breakfast, Lunch...)
// show in the app's language and stay NutriTrace's defaults unless renamed. What was logged is
// filed by a meal's place in the list, so moving or deleting a meal moves that place's foods with
// it. Delete has no confirm: it is undone from the toast.
export function MealSheet({ slot, close }) {
  const opened = useNutrition.getState().settings.data
  const meals = mealsOf(opened)
  const shown = mealLabels(opened)
  const adding = slot >= meals.length
  const original = adding ? null : meals[slot]
  const [name, setName] = useState(adding ? '' : shown[slot])
  const { busy, error, submit } = useSheetSave(close)
  const run = build => submit('mealNames', data => {
    const now = mealsOf(data)
    if (!adding && now[slot]?.name !== original.name) return { error: 'stale' }
    return build(now.map(m => m.name))
  }, mealErrorOf)
  // A default name left as it was shown is not typed by anyone: keep NutriTrace's own.
  const kept = !adding && original.isDefault && name.trim() === shown[slot] ? original.name : name

  const remove = async () => {
    let outcome = null
    const done = await run(list => {
      const built = removeMeal(list, slot)
      if (!built.error) outcome = { name: shown[slot], before: list, after: built.list }
      return built
    })
    if (done && outcome) offerMealUndo(outcome)
  }

  return (
    <BottomSheet title={adding ? t('Add a meal') : shown[slot]}>
      <div className="set-sheet">
        <TextField label={t('Name')} value={name} onChange={setName} inputProps={{ maxLength: MEAL_NAME_MAX, autoFocus: true }}
          hint={adding ? undefined : t('Renaming keeps everything logged under it.')} />
        {error && <InlineBanner role="alert" tone="warning" icon="warning" title={error} />}
        <Button variant="primary" block haptic busy={busy} onClick={() => run(list => setMealName(list, slot, kept))}>
          {adding ? t('Add meal') : t('Save meal name')}
        </Button>
        {!adding && (
          <div className="set-sheet-pair">
            <Button variant="secondary" icon="arrowUp" disabled={busy || slot === 0} onClick={() => run(list => moveMeal(list, slot, -1))}>{t('Move up')}</Button>
            <Button variant="secondary" icon="arrowDown" disabled={busy || slot === meals.length - 1} onClick={() => run(list => moveMeal(list, slot, 1))}>{t('Move down')}</Button>
          </div>
        )}
        {!adding && <Button variant="danger" block icon="trash" disabled={busy || meals.length <= 1} onClick={remove}>{t('Delete meal')}</Button>}
      </div>
    </BottomSheet>
  )
}

export const openMealSheet = slot => useUI.getState().openSheet(close => <MealSheet slot={slot} close={close} />, { variant: 'ds' })
