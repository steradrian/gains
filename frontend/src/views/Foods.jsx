import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { energyOf, foodKcal } from '../lib/nutrition/diary.js'
import { SORTS, categoriesOf, fmtAmount, foodErrorText, searchErrorText, visibleFoods } from '../lib/nutrition/foods.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { MIN_QUERY, useOnlineSearch } from '../lib/nutrition/use-online-search.js'
import Icon from '../components/Icon.jsx'
import SubHeader from '../components/SubHeader.jsx'
import { foodDetailSheet } from '../components/FoodDetailSheet.jsx'
import { foodEditSheet } from '../components/FoodEditSheet.jsx'
import { Button, SearchField, Segmented } from '../components/ui.jsx'

const toast = m => useUI.getState().toast(m)

// Nutrition › Foods: your own foods (search, category, sort), and Open Food Facts for the ones
// you do not have yet. NutriTrace's Foods page without its Meals and Recipes tabs, which are
// their own pages here.
export default function Foods() {
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const foods = useNutrition(s => s.foods)
  const settings = useNutrition(s => s.settings.data)
  const [mode, setMode] = useState('mine')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('alpha')
  const [category, setCategory] = useState('')
  const online = useOnlineSearch(q, { active: on && mode === 'online', lang: settings?.offSearchLanguage || 'en' })

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    n.loadFoods({ force: true })
  }, [on])

  if (!on) {
    return <>
      <SubHeader title={t('Foods')} />
      <div className="card"><div className="empty">
        <div className="ico"><Icon name="apple" /></div>
        <strong>{t('Foods live in the web app')}</strong>
        <div>{t('Sign in on the web app to keep your foods here.')}</div>
      </div></div>
    </>
  }

  const categories = categoriesOf(foods.list)
  // A category nobody uses any more (its last food was deleted or moved) is no filter.
  const activeCategory = categories.includes(category) ? category : ''
  const list = visibleFoods(foods.list, { query: q, category: activeCategory, sort })
  const open = food => foodDetailSheet({ food, settings, onEdit: f => foodEditSheet({ food: f, settings }) })
  const saveResult = async food => {
    await useNutrition.getState().saveFood(food)
    toast(t('Saved to your foods'))
  }
  const owned = result => !!result.barcode && foods.list.some(f => f.barcode === result.barcode)

  const row = food => {
    const kcal = energyOf(foodKcal(food), settings)
    return <div key={food.id} className="item" {...tappable(() => open(food))}>
      <div className="grow">
        <div className="tt">{food.favorite && <Icon name="starFill" className="fav-star" />}{food.name}</div>
        <div className="ss">{[food.brand, `${fmtAmount(food.portion ?? 100)} ${food.unit || 'g'}`].filter(Boolean).join(' · ')}</div>
      </div>
      <span className="tag">{kcal.value} {kcal.unit}</span>
      <Icon name="chevronRight" className="chev" />
    </div>
  }

  const resultRow = (result, i) => {
    const kcal = energyOf(foodKcal(result), settings)
    const have = owned(result)
    return <div key={result.barcode || result.client_key || i} className="item" {...tappable(() => foodDetailSheet({ food: result, settings, onSave: have ? undefined : saveResult }))}>
      <div className="grow">
        <div className="tt">{result.name}</div>
        <div className="ss">{[result.brand, t('per 100 g')].filter(Boolean).join(' · ')}</div>
      </div>
      <span className="tag">{kcal.value} {kcal.unit}</span>
      {have
        ? <span className="tag acc">{t('Saved')}</span>
        : <Button size="sm" variant="tinted" onClick={ev => { ev.stopPropagation(); saveResult(result).catch(e => toast(foodErrorText(e, { write: true }))) }}>{t('Save')}</Button>}
    </div>
  }

  let body
  if (mode === 'online') {
    if (q.trim().length < MIN_QUERY) body = <div className="empty"><div className="ico"><Icon name="globe" /></div>{t('Type a food to search Open Food Facts.')}</div>
    else if (online.status === 'error') body = <div className="empty" role="alert">{searchErrorText(online.error)}</div>
    else if (online.status !== 'ready') body = <div className="empty" role="status">{t('Searching…')}</div>
    else if (!online.results.length) body = <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No results online.')}</div>
    else body = <div className="list">{online.results.map(resultRow)}</div>
  } else if (foods.status === 'error' && !foods.list.length) {
    body = <div className="empty" role="alert">
      <div>{foodErrorText(foods.error)}</div>
      <Button size="sm" variant="tinted" onClick={() => useNutrition.getState().loadFoods({ force: true })}>{t('Try again')}</Button>
    </div>
  } else if (foods.status !== 'ready' && !foods.list.length) {
    body = <div className="empty" role="status">{t('Loading…')}</div>
  } else if (!foods.list.length) {
    body = <div className="empty">
      <div className="ico"><Icon name="apple" /></div>
      <strong>{t('No foods yet')}</strong>
      <div>{t('Create a food, or search online and save one.')}</div>
      <Button size="sm" variant="tinted" icon="plus" onClick={() => foodEditSheet({ settings })}>{t('New food')}</Button>
    </div>
  } else if (!list.length) {
    body = <div className="empty">
      <div className="ico"><Icon name="magnifier" /></div>
      {t('No match')}
      {q.trim().length >= MIN_QUERY && <Button size="sm" variant="tinted" onClick={() => setMode('online')}>{t('Search online')}</Button>}
    </div>
  } else {
    body = <div className="list">{list.map(row)}</div>
  }

  return <>
    <SubHeader title={t('Foods')} sub={mode === 'mine' && foods.status === 'ready' ? tn('{0} food', '{0} foods', foods.list.length) : undefined}
      action={<Button size="sm" variant="tinted" icon="plus" onClick={() => foodEditSheet({ settings })}>{t('New')}</Button>} />
    <div className="foods-controls">
      <Segmented value={mode} onChange={setMode} options={[{ value: 'mine', label: t('My foods') }, { value: 'online', label: t('Online') }]} />
      <SearchField value={q} placeholder={mode === 'online' ? t('Search Open Food Facts') : t('Search your foods')} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} />
      {mode === 'mine' && foods.list.length > 1 && <Segmented value={sort} onChange={setSort}
        options={SORTS.map(s => ({ value: s, label: s === 'alpha' ? t('A to Z') : s === 'recent' ? t('Recent') : t('Most used') }))} />}
      {mode === 'mine' && categories.length > 0 && <div className="chips">
        <button className={'chip nocap' + (!activeCategory ? ' on' : '')} onClick={() => setCategory('')}>{t('All')}</button>
        {categories.map(c => <button key={c} className={'chip nocap' + (activeCategory === c ? ' on' : '')} onClick={() => setCategory(c)}>{c}</button>)}
      </div>}
    </div>
    {body}
  </>
}
