import { useEffect, useMemo, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import { energyOf, nutritionOf } from '../lib/nutrition/diary.js'
import { amountOf, mealDraft, mealErrorText, servingsOf, slotName, totalOf } from '../lib/nutrition/meals.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { confirmSheet } from '../sheets.jsx'
import MealNutrition from './MealNutrition.jsx'
import { mealEditSheet } from './MealEditSheet.jsx'
import { Button, NumberField, Row, Section } from './ui.jsx'

const toast = (m, opts) => useUI.getState().toast(m, opts)

// A saved meal or recipe: what is in it, and Log. The date and meal are the ones the diary has
// selected, taken once as the sheet opens, so what the button says is what it logs to. The log is
// built once per amount: Log again after a failure sends the same entries, so a save whose answer
// was lost does not log twice. Reads the meal from the store, so an edit shows here at once.
export function MealDetailSheet({ id, recipe, settings = null, close }) {
  const meal = useNutrition(s => (recipe ? s.recipes : s.meals).list.find(m => m.id === id))
  const [target] = useState(() => useDiarySelection.getState().target(settings))
  const [servings, setServings] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Deleted from here (or by a sync): nothing left to show.
  useEffect(() => { if (!meal) close() }, [meal, close])

  const draft = useMemo(() => {
    if (!meal) return null
    try { return mealDraft(meal, { slot: target.meal, servings }) } catch { return null }
  }, [meal, target.meal, servings])

  if (!meal) return null

  const where = slotName(settings, target.meal)
  const per = recipe ? nutritionOf({ nutrition: meal.nutrition }) : totalOf(meal.items)
  const eatenKcal = energyOf(Math.round((per.calories || 0) * (Number(servings) || 0)), settings)

  async function log() {
    if (!draft || busy) return
    setBusy(true)
    setError('')
    try {
      const items = await useNutrition.getState().logMeal(target.date, draft)
      close()
      toast(t('Logged to {0}', where), {
        action: t('Undo'),
        onAction: () => { useNutrition.getState().removeItems(target.date, items.map(i => i.uuid)).catch(e => toast(mealErrorText(e, { write: true }))) },
      })
    } catch (e) {
      setError(mealErrorText(e, { write: true }))
      setBusy(false)
    }
  }

  function remove() {
    confirmSheet({
      title: recipe ? t('Delete this recipe?') : t('Delete this meal?'),
      message: t('“{0}” is removed. Days you already logged it to keep it.', meal.name),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        try {
          await useNutrition.getState().deleteMeal(meal.id)
          toast(recipe ? t('Recipe deleted') : t('Meal deleted'))
        } catch (e) {
          toast(mealErrorText(e, { write: true }))
        }
      },
    })
  }

  const sub = recipe
    ? [tn('{0} serving', '{0} servings', servingsOf(meal)), `${Math.round((Number(meal.portion) || 0) * 10) / 10} ${meal.unit || 'g'}`].join(' · ')
    : tn('{0} ingredient', '{0} ingredients', meal.items.length)
  return <>
    <div className="row between">
      <h3>{meal.name}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Close')}</Button>
    </div>
    <div className="small muted">{sub}</div>
    <MealNutrition nutrition={per} settings={settings} label={recipe ? t('Per serving') : t('Total')} />
    {meal.items.length > 0 && <>
      <h4 className="sec">{t('Ingredients')}</h4>
      <div className="list">
        {meal.items.map((item, i) => {
          const kcal = energyOf(nutritionOf(item).calories || 0, settings)
          return <div key={i} className="item">
            <div className="grow">
              <div className="tt">{item.name}</div>
              <div className="ss">{amountOf(item)}</div>
            </div>
            <span className="tag">{Math.round(kcal.value)} {kcal.unit}</span>
          </div>
        })}
      </div>
    </>}
    {meal.notes && <div className="small muted">{meal.notes}</div>}
    <h4 className="sec">{t('Log')}</h4>
    <div className="small muted">{t('Logging to {0} · {1}', where, fmtDate(target.date, true))}</div>
    {recipe && <label className="measure-date">
      <span>{t('Servings eaten')}</span>
      <NumberField value={servings} onChange={setServings} aria-label={t('Servings eaten')} />
    </label>}
    {!draft && <div className="small muted" role="status">{recipe ? t('Enter servings above 0.') : t('This meal has no ingredients to log.')}</div>}
    {draft && recipe && <div className="small muted">{t('{0} in total', `${eatenKcal.value} ${eatenKcal.unit}`)}</div>}
    {error && <div className="small muted" role="alert">{error}</div>}
    <Button variant="primary" onClick={log} disabled={!draft || busy}>{busy ? t('Saving…') : t('Log to {0}', where)}</Button>
    <Section>
      <Row icon="pencil" title={t('Edit')} onClick={() => mealEditSheet({ meal, recipe, settings })} />
      <Row icon="trash" title={recipe ? t('Delete recipe') : t('Delete meal')} danger onClick={remove} />
    </Section>
  </>
}

/** Opens the sheet over the page. */
export function mealDetailSheet(props) {
  useUI.getState().openSheet(close => <MealDetailSheet {...props} close={close} />)
}
