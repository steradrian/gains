import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { mealLabels } from '../lib/nutrition/meal-name.js'
import { MEAL_NAME_MAX, MEAL_NAMES_MAX, moveMeal, removeMeal, setMealName } from '../lib/nutrition/settings-lists.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useSheetSave } from '../lib/nutrition/use-nt-settings.js'
import { Button, TextField } from './ui.jsx'
import { SheetHeader, SheetActions } from './sheet-layout.jsx'

const errorOf = code => ({
  name: t('Give the meal a name of up to {0} characters.', MEAL_NAME_MAX),
  full: t('There can be at most {0} meals.', MEAL_NAMES_MAX),
  last: t('A day needs at least one meal.'),
  slot: t('That meal is not there any more.'),
})[code]

const namesOf = data => mealLabels(data)

// NutriTrace's meal names (Diary.svelte): rename a meal, move it up or down, or take it out;
// `slot` equal to the number of meals adds a new one. The names are written whole. What was logged
// stays in its slot (the diary files an entry by its meal's place in the list), so moving or
// removing a meal moves that slot's entries with it.
export default function MealNameSheet({ slot, close }) {
  const names = namesOf(useNutrition.getState().settings.data)
  const adding = slot >= names.length
  const [name, setName] = useState(adding ? '' : names[slot])
  const { busy, error, submit } = useSheetSave(close)
  const run = build => submit('mealNames', data => build(namesOf(data)), errorOf)

  return <div className="quick-sheet">
    <SheetHeader title={adding ? t('Add a meal') : t('Edit meal')} />
    <label className="portion-f">
      <span className="small muted">{t('Name')}</span>
      <TextField value={name} maxLength={MEAL_NAME_MAX} onChange={e => setName(e.target.value)} aria-label={t('Name')} autoFocus />
    </label>
    {error && <div className="nt-error small" role="alert">{error}</div>}
    <SheetActions>
      <Button variant="primary" onClick={() => run(list => setMealName(list, slot, name))} disabled={busy}>{busy ? t('Saving…') : t('Save')}</Button>
      {!adding && <Button icon="arrowUp" onClick={() => run(list => moveMeal(list, slot, -1))} disabled={busy || slot === 0}>{t('Move up')}</Button>}
      {!adding && <Button icon="arrowDown" onClick={() => run(list => moveMeal(list, slot, 1))} disabled={busy || slot === names.length - 1}>{t('Move down')}</Button>}
      {!adding && <Button variant="danger" icon="trash" onClick={() => run(list => removeMeal(list, slot))} disabled={busy || names.length <= 1}>{t('Remove')}</Button>}
    </SheetActions>
  </div>
}

export function mealNameSheet(slot) {
  useUI.getState().openSheet(close => <MealNameSheet slot={slot} close={close} />)
}
