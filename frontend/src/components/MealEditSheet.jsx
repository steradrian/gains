import { useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { energyOf, newUuid, nutritionOf } from '../lib/nutrition/diary.js'
import { amountOf, formOf, mealErrorText, mealOf, problemText, totalOf, withItems } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { ingredientSheet } from './IngredientSheet.jsx'
import Icon from './Icon.jsx'
import MealNutrition from './MealNutrition.jsx'
import { Button, TextArea, TextField } from './ui.jsx'

const toast = m => useUI.getState().toast(m)

// Create (no `meal`) or edit a saved meal or recipe. Nothing is sent until Save; a failed save keeps
// everything typed. A new one carries one key for as long as the sheet is open, so a retry after a
// lost answer saves it once. A recipe's total weight follows its ingredients until you type it.
export function MealEditSheet({ meal = null, recipe, settings = null, close, onSaved }) {
  const editing = typeof meal?.id === 'number'
  const [form, setForm] = useState(() => formOf(meal, { recipe }))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const key = useRef(newUuid())

  const set = patch => setForm(f => ({ ...f, ...patch }))
  const setItems = change => setForm(f => withItems(f, change(f.items), { recipe }))
  const addIngredient = ingredient => setItems(items => [...items, ingredient])
  const changeIngredient = (i, ingredient) => setItems(items => items.map((x, j) => (j === i ? ingredient : x)))
  const removeIngredient = i => setItems(items => items.filter((_, j) => j !== i))

  const servings = Number(form.servings)
  const perServing = recipe && Number.isInteger(servings) && servings >= 1
    ? Object.fromEntries(Object.entries(totalOf(form.items)).map(([k, v]) => [k, v / servings]))
    : null

  async function save() {
    if (busy) return
    const made = mealOf(form, { recipe, clientKey: editing ? null : key.current })
    if (made.error) { setProblem(problemText(made.error)); return }
    setProblem('')
    setBusy(true)
    try {
      const saved = await useNutrition.getState().saveMeal(editing ? { ...made.meal, id: meal.id } : made.meal)
      close()
      toast(recipe ? t('Recipe saved') : t('Meal saved'))
      onSaved?.(saved)
    } catch (e) {
      setProblem(mealErrorText(e, { write: true }))
      setBusy(false)
    }
  }

  const title = recipe ? (editing ? t('Edit recipe') : t('New recipe')) : (editing ? t('Edit meal') : t('New meal'))
  return <>
    <div className="row between">
      <h3>{title}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Cancel')}</Button>
    </div>
    <label className="measure-date">
      <span>{t('Name')}</span>
      <TextField value={form.name} maxLength={120} autoFocus={!editing} onChange={e => set({ name: e.target.value })} />
    </label>
    {recipe && <div className="measure-form">
      <label className="measure-field">
        <span>{t('Servings')}</span>
        <span className="measure-input">
          <input className="num" inputMode="numeric" value={form.servings} onChange={e => set({ servings: e.target.value.replace(/\D/g, '') })} aria-label={t('Servings')} />
        </span>
      </label>
      <label className="measure-field">
        <span>{t('Total weight')}</span>
        <span className="measure-input">
          <input className="num" inputMode="decimal" value={form.amount} onChange={e => set({ amount: e.target.value })} aria-label={t('Total weight')} />
          <i>{form.unit}</i>
        </span>
      </label>
    </div>}
    <h4 className="sec">{t('Ingredients')}</h4>
    {form.items.length > 0 && <div className="list">
      {form.items.map((item, i) => {
        const kcal = energyOf(nutritionOf(item).calories || 0, settings)
        return <div key={i} className="item" {...tappable(() => ingredientSheet({ item, settings, onDone: x => changeIngredient(i, x) }))}>
          <div className="grow">
            <div className="tt">{item.name}</div>
            <div className="ss">{amountOf(item)}</div>
          </div>
          <span className="tag">{Math.round(kcal.value)} {kcal.unit}</span>
          <button type="button" className="iconbtn" aria-label={t('Remove {0}', item.name)}
            onClick={ev => { ev.stopPropagation(); removeIngredient(i) }}><Icon name="trash" /></button>
        </div>
      })}
    </div>}
    <div className="measure-options">
      <Button size="sm" variant="tinted" icon="plus" onClick={() => ingredientSheet({ settings, onDone: addIngredient })}>{t('Add ingredient')}</Button>
    </div>
    {form.items.length > 0 && <MealNutrition nutrition={recipe ? perServing : totalOf(form.items)} settings={settings} label={recipe ? t('Per serving') : t('Total')} />}
    <label className="measure-date">
      <span>{t('Notes')}</span>
      <TextArea value={form.notes} maxLength={500} onChange={e => set({ notes: e.target.value })} />
    </label>
    {problem && <div className="small muted" role="alert">{problem}</div>}
    <Button variant="primary" onClick={save} disabled={busy}>{busy ? t('Saving…') : t('Save')}</Button>
  </>
}

/** Opens the editor over the page. */
export function mealEditSheet(opts) {
  useUI.getState().openSheet(close => <MealEditSheet {...opts} close={close} />)
}
