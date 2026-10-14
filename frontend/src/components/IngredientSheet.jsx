import { useEffect, useMemo, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { energyOf, foodKcal, matchesFood, unitsFor } from '../lib/nutrition/diary.js'
import { ingredientOf, mealErrorText, rescaleIngredient } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import Icon from './Icon.jsx'
import MealNutrition from './MealNutrition.jsx'
import { Button, NumberField, SearchField } from './ui.jsx'

const SHOWN = 50

// One ingredient of a meal or recipe: pick one of your foods and say how much, or (with `item`)
// change the amount of one already in it. Hands the ingredient to `onDone` and closes.
export function IngredientSheet({ item = null, settings = null, onDone, close }) {
  const foods = useNutrition(s => s.foods)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(item)
  const [amount, setAmount] = useState(item ? (parseFloat(item.portion) || 0) * (parseFloat(item.quantity) || 1) : 0)
  const [unit, setUnit] = useState(item?.unit || 'g')

  useEffect(() => { if (!item) useNutrition.getState().loadFoods() }, [item])

  const ingredient = useMemo(() => {
    if (!picked) return null
    try { return item ? rescaleIngredient(item, amount, unit) : ingredientOf(picked, amount, unit) } catch { return null }
  }, [picked, item, amount, unit])

  const pick = food => {
    setPicked(food)
    setAmount(Number(food.portion) || 100)
    setUnit(food.unit || 'g')
  }

  const done = () => {
    if (!ingredient) return
    onDone(ingredient)
    close()
  }

  if (!picked) {
    const list = foods.list.filter(f => matchesFood(f, q)).slice(0, SHOWN)
    let body
    if (foods.status === 'error' && !foods.list.length) {
      body = <div className="empty" role="alert">
        <div>{mealErrorText(foods.error)}</div>
        <Button size="sm" variant="tinted" onClick={() => useNutrition.getState().loadFoods({ force: true })}>{t('Try again')}</Button>
      </div>
    } else if (foods.status !== 'ready' && !foods.list.length) {
      body = <div className="empty" role="status">{t('Loading…')}</div>
    } else if (!foods.list.length) {
      body = <div className="empty"><div className="ico"><Icon name="apple" /></div>{t('No foods yet. Save some under Foods first.')}</div>
    } else if (!list.length) {
      body = <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>
    } else {
      body = <div className="list">{list.map(f => {
        const kcal = energyOf(foodKcal(f), settings)
        return <div key={f.id} className="item" {...tappable(() => pick(f))}>
          <div className="grow">
            <div className="tt">{f.name}</div>
            <div className="ss">{[f.brand, `${Math.round((Number(f.portion) || 100) * 100) / 100} ${f.unit || 'g'}`].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="tag">{kcal.value} {kcal.unit}</span>
        </div>
      })}</div>
    }
    return <>
      <div className="row between">
        <h3>{t('Add ingredient')}</h3>
        <Button size="sm" variant="ghost" onClick={close}>{t('Cancel')}</Button>
      </div>
      <SearchField value={q} placeholder={t('Search your foods')} autoFocus onChange={e => setQ(e.target.value)} onClear={() => setQ('')} />
      {body}
    </>
  }

  return <>
    <div className="row between">
      <h3>{picked.name}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Cancel')}</Button>
    </div>
    <label className="measure-date">
      <span>{t('Amount')}</span>
      <NumberField value={amount} onChange={setAmount} aria-label={t('Amount')} />
    </label>
    <div className="chips" role="radiogroup" aria-label={t('Unit')}>
      {unitsFor(picked).map(u => <button key={u} type="button" role="radio" aria-checked={u === unit}
        className={'chip nocap' + (u === unit ? ' on' : '')} onClick={() => setUnit(u)}>{u}</button>)}
    </div>
    {ingredient
      ? <MealNutrition nutrition={ingredient.nutrition} settings={settings} />
      : <div className="small muted" role="status">{t('Enter an amount above 0.')}</div>}
    <Button variant="primary" onClick={done} disabled={!ingredient}>{item ? t('Save') : t('Add')}</Button>
    {!item && <Button variant="ghost" onClick={() => setPicked(null)}>{t('Choose another food')}</Button>}
  </>
}

/** Opens the sheet over the editor. */
export function ingredientSheet(props) {
  useUI.getState().openSheet(close => <IngredientSheet {...props} close={close} />)
}
