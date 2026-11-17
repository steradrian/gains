import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { foodKcal, gramsOfPortion, nutritionOf } from '../lib/nutrition/diary.js'
import { openNewFood } from '../lib/nutrition/editor-routes.js'
import { fmtAmount, nutrientLabel } from '../lib/nutrition/foods.js'
import { writeErrorText } from '../lib/nutrition/log-feedback.js'
import { ingredientOf, rescaleIngredient } from '../lib/nutrition/meals.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { OWN_SHOWN, useFoodSearch } from '../lib/nutrition/use-food-search.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { kcalText } from '../views/my-foods/library-text.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import TextField from '../ds/TextField.jsx'
import Icon from './Icon.jsx'
import { Loading } from './Loader.jsx'
import LogFoodRow from './LogFoodRow.jsx'
import OnlineStatus from './OnlineStatus.jsx'
import { scanSheet } from './ScanSheet.jsx'

const MACROS = ['proteins', 'carbohydrates', 'fat']
const parseAmount = v => parseFloat(String(v ?? '').replace(',', '.'))
const shown = n => String(Math.round(n * 100) / 100)

// The ingredient for `value` of `to`: the chosen food at that amount, or the one opened, rescaled
// from what it was. Null while the amount is not a number above 0.
function ingredientAt(food, item, value, to) {
  const n = parseAmount(value)
  if (!(n > 0)) return null
  try { return food ? ingredientOf(food, n, to) : rescaleIngredient(item, n, to) } catch { return null }
}

// One ingredient of a recipe or a saved meal (board Ea5Ingredient): a food is searched or scanned
// (yours or Open Food Facts), then its amount and unit (g or ml) are set, with the energy and
// protein, carbs and fat of that amount under them. Every change goes into the editor as it is
// made, so there is nothing to confirm: Done only closes. Take out removes it (the editor offers
// Undo). Opened on an ingredient (`item`, at `index`) it starts on that; Swap food goes back to the
// search, and a food chosen there replaces it. `onAdd(ingredient)` puts a new one in and answers
// where it went; `onChange(index, ingredient)` and `onRemove(index)` act on it from then on.
// Scan opens over this drawer as a sub-panel of it (store/useUI.js openSheet).
export function IngredientDrawer({ item = null, index = null, onAdd, onChange, onRemove, close }) {
  const settings = useNutrition(s => s.settings.data)
  const [at, setAt] = useState(index)
  const [picked, setPicked] = useState(null)
  const [swapping, setSwapping] = useState(!item)
  const [amount, setAmount] = useState(item ? shown((parseFloat(item.portion) || 0) * (parseFloat(item.quantity) || 1)) : '')
  const [unit, setUnit] = useState(item?.unit || 'g')
  // The amount field shows its own text; a food chosen here sets it, so it is drawn again.
  const [nonce, setNonce] = useState(0)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(OWN_SHOWN)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(null)
  const alive = useRef(true)
  const search = useRef(null)

  useEffect(() => { useNutrition.getState().loadSettings() }, [])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const { query: q, recents, own, ownTotal, online, foods } = useFoodSearch(query, { limit })

  const ingredient = useMemo(() => ingredientAt(picked, item, amount, unit), [picked, item, amount, unit])

  const edit = (nextAmount, nextUnit) => {
    setAmount(nextAmount)
    setUnit(nextUnit)
    const next = ingredientAt(picked, item, nextAmount, nextUnit)
    if (next && at != null) onChange(at, next)
  }

  // A food chosen: at its own serving when that is a weight or a volume (g or ml), else the grams
  // that serving weighs (a slice the food knows the size of), else its own unit, which then joins
  // g and ml among the unit choices (an egg is 1 piece, not 100 g).
  const pick = food => {
    const portion = Number(food.portion) || 100
    const grams = gramsOfPortion(portion, food.unit || 'g', food)
    let start
    if (food.unit === 'g' || food.unit === 'ml') start = { unit: food.unit, amount: portion }
    else if (grams > 0) start = { unit: 'g', amount: Math.round(grams * 10) / 10 }
    else start = { unit: food.unit || 'g', amount: portion }
    const made = ingredientOf(food, start.amount, start.unit)
    if (at == null) setAt(onAdd(made))
    else onChange(at, made)
    setPicked(food)
    setAmount(shown(start.amount))
    setUnit(start.unit)
    setNonce(n => n + 1)
    setSwapping(false)
  }

  // A food from Open Food Facts or a barcode is saved first (its client_key makes a retry after a
  // lost answer one food), then used: an ingredient points at a saved food. A save that failed
  // keeps its food, key included: Try again sends that same one.
  const choose = async food => {
    if (saving) return
    if (typeof food.id === 'number') { pick(food); return }
    setSaving(true)
    setFailed(null)
    try {
      const saved = await useNutrition.getState().saveFood(food)
      if (alive.current) pick(saved)
    } catch (e) {
      if (alive.current) setFailed({ food, text: writeErrorText(e) })
    }
    if (alive.current) setSaving(false)
  }

  const takeOut = () => {
    if (at != null) onRemove(at)
    close()
  }

  if (swapping) {
    const energy = f => kcalText(foodKcal(f), settings)
    const row = (f, icon) => (
      <LogFoodRow key={f.id ?? f.client_key} icon={icon} title={f.name} busy={saving} haptic
        subtitle={[f.brand, `${f.portion || 100} ${f.unit || 'g'}`, energy(f)].filter(Boolean).join(' · ')} onAdd={() => choose(f)} />
    )
    const heading = text => <h2 className="g-lf-sec">{text}</h2>
    const note = text => <p className="g-lf-note">{text}</p>
    const failedList = foods.status === 'error' && !foods.list.length
    return (
      <BottomSheet type="full" title={t('Add ingredient')}
        head={
          <label className="g-lf-search">
            <Icon name="magnifier" className="g-icon" />
            <input ref={search} type="search" value={query} placeholder={t('Search foods')} aria-label={t('Search foods')} autoFocus enterKeyHint="search"
              onChange={e => { setQuery(e.target.value); setLimit(OWN_SHOWN) }}
              onKeyDown={e => { if (e.key === 'Enter' && online.status === 'tap') online.ask() }} />
            {query && <button type="button" className="g-lf-clear" onClick={() => { setQuery(''); setLimit(OWN_SHOWN); search.current?.focus() }} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
          </label>
        }
        footer={
          <div className="g-lf-foot">
            <Button variant="secondary" icon="scanBarcode" onClick={() => scanSheet({ onPick: choose })}>{t('Scan')}</Button>
            <Button variant="secondary" onClick={() => openNewFood({ name: q }, close)}>{t('Create a food')}</Button>
          </div>
        }>
        <div className="g-lf-body">
          {failed && <>
            <p className="g-lf-note g-lf-err" role="alert">{failed.text}</p>
            <Button variant="secondary" size="sm" onClick={() => choose(failed.food)}>{t('Try again')}</Button>
          </>}
          {failedList && <>
            <p className="g-lf-note g-lf-err" role="alert">{t('Your foods did not load.')}</p>
            <Button variant="secondary" size="sm" onClick={() => useNutrition.getState().loadFoods({ force: true })}>{t('Try again')}</Button>
          </>}
          {foods.status === 'loading' && !foods.list.length && <Loading className="g-lf-note" />}
          {q ? <>
            {heading(t('Your foods'))}
            {own.length ? own.map(f => row(f)) : note(t('None of your foods match.'))}
            {ownTotal > own.length && <Button variant="ghost" size="sm" onClick={() => setLimit(n => n + OWN_SHOWN)}>{t('Show more')}</Button>}
            {settingOf(settings, 'offEnabled') && <>
              {heading(t('Open Food Facts'))}
              <OnlineStatus online={online} query={q} />
              {online.status === 'ready' && !online.results.length && note(t('Nothing found online.'))}
              {online.status === 'idle' && note(t('Type at least two letters to search online.'))}
              {online.results.map(f => row(f, 'globe'))}
            </>}
          </> : <>
            {foods.status === 'ready' && !foods.list.length && note(t('Foods you log show up here. Search to find one.'))}
            {recents.map(f => row(f))}
            {own.map(f => row(f))}
          </>}
        </div>
      </BottomSheet>
    )
  }

  const name = picked ? picked.name : item?.name
  const value = parseAmount(amount)
  const per100 = ingredient && value > 0 && (unit === 'g' || unit === 'ml')
    ? (nutritionOf(ingredient).calories || 0) * 100 / value : null
  const sub = [
    (picked ? typeof picked.id === 'number' : item?.id != null) ? t('Your food') : t('Open Food Facts'),
    per100 != null ? (unit === 'ml' ? t('{0} per 100 ml', kcalText(Math.round(per100), settings)) : t('{0} per 100 g', kcalText(Math.round(per100), settings))) : '',
  ].filter(Boolean).join(' · ')
  const units = [...new Set(['g', 'ml', unit])]
  const nutrition = ingredient ? nutritionOf(ingredient) : null

  return (
    <BottomSheet type="half" title={name}
      footer={
        <div className="g-mf-acts">
          {at != null && <Button variant="secondary" haptic onClick={takeOut}>{t('Take out')}</Button>}
          <Button onClick={close}>{t('Done')}</Button>
        </div>
      }>
      <p className="g-mf-sub">{sub}</p>
      <button type="button" className="g-ing-swap" onClick={() => setSwapping(true)}>
        <Icon name="magnifier" className="g-icon" />{t('Swap food')}
      </button>
      <div className="g-ing-fields">
        <TextField key={nonce} label={t('Amount')} unit={unit} inputMode="decimal" value={amount} onChange={v => edit(v, unit)} />
        <SegmentedControl label={t('Unit')} value={unit} options={units} onChange={u => edit(amount, u)} />
      </div>
      {nutrition
        ? (
          <div className="g-mf-macros g-ing-stats">
            <div><b>{kcalText(Math.round(nutrition.calories || 0), settings)}</b><span>{nutrientLabel('calories')}</span></div>
            {MACROS.map(id => <div key={id}><b>{t('{0} g', fmtAmount(nutrition[id] || 0))}</b><span>{nutrientLabel(id)}</span></div>)}
          </div>
        )
        : <p className="g-mf-sub" role="status">{t('Enter an amount above 0.')}</p>}
    </BottomSheet>
  )
}

/** Opens the drawer over the editor. `item` and `index` start it on an ingredient of the recipe. */
export function ingredientDrawer(props) {
  useUI.getState().openSheet(close => <IngredientDrawer {...props} close={close} />, { variant: 'ds' })
}
