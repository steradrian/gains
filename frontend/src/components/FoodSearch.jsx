import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { foodKcal } from '../lib/nutrition/diary.js'
import { searchErrorText } from '../lib/nutrition/foods.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useFoodSearch } from '../lib/nutrition/use-food-search.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import { ItemRow, SectionTitle } from './blocks.jsx'
import { foodEditSheet } from './FoodEditSheet.jsx'
import Icon from './Icon.jsx'
import { scanSheet } from './ScanSheet.jsx'
import { Button, SearchField } from './ui.jsx'

function FoodRow({ food, onPick, energy }) {
  return <ItemRow className="food-row" onClick={() => onPick(food)} title={food.name}
    subtitle={[food.brand, `${food.portion || 100} ${food.unit || 'g'}`].filter(Boolean).join(' · ')}
    trailing={<span className="food-kcal small">{energy(foodKcal(food))}</span>} />
}

// The one place a food is picked: search, scan or create, in groups. Recents, then your own
// foods, then Open Food Facts (labelled, Romanian products first). `onPick(food)` gets the food
// tapped; it has no `id` when it came from Open Food Facts or a barcode, so a place that needs a
// saved food saves it first. `scan` is what the barcode sheet needs besides the pick (a diary
// target to log to); pass `{ onPick }` to have the scanned food handed over instead of logged.
// A food made from "Create food" is picked once saved. `children` follow the groups.
export default function FoodSearch({ onPick, scan = {}, autoFocus = false, children }) {
  const [query, setQuery] = useState('')
  const { query: q, recents, own, online, foods } = useFoodSearch(query)
  const settings = useNutrition(s => s.settings.data)
  const { energy } = useUnits()
  const rows = list => <div className="list">{list.map(f => <FoodRow key={f.id ?? f.client_key} food={f} onPick={onPick} energy={energy} />)}</div>

  return <div className="food-picker">
    <div className="fp-search">
      <SearchField value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery('')}
        placeholder={t('Search foods')} aria-label={t('Search foods')} autoFocus={autoFocus} enterKeyHint="search" />
      <Button size="sm" variant="tinted" icon="scanBarcode" className="fp-scan" aria-label={t('Scan a barcode')}
        onClick={() => scanSheet(scan)} />
    </div>

    <ItemRow className="food-row fp-create" onClick={() => foodEditSheet({ food: { name: q }, settings, onSaved: onPick })}
      lead={<span className="lrow-i tint-blue"><Icon name="plus" /></span>}
      title={t('Create food')} subtitle={q || undefined} chevron />

    {!q && <>
      <SectionTitle>{t('Recent')}</SectionTitle>
      {foods.status === 'loading' && !foods.list.length && <div className="muted small fp-note">{t('Loading…')}</div>}
      {foods.status === 'error' && <div className="nt-error small" role="alert">{t('Your foods did not load.')}</div>}
      {foods.status === 'ready' && !recents.length && <div className="muted small fp-note">{t('Foods you log show up here. Search to find one.')}</div>}
      {rows(recents)}
    </>}

    {(q || own.length > 0) && <>
      <SectionTitle>{t('Your foods')}</SectionTitle>
      {own.length ? rows(own) : <div className="muted small fp-note">{t('None of your foods match.')}</div>}
    </>}

    {q && <>
      <SectionTitle>{t('Open Food Facts')}</SectionTitle>
      {online.status === 'loading' && <div className="muted small fp-note" role="status">{t('Searching Open Food Facts…')}</div>}
      {online.status === 'error' && <div className="nt-error small" role="alert">{searchErrorText(online.error)}</div>}
      {online.status === 'ready' && !online.results.length && <div className="muted small fp-note">{t('Nothing found online.')}</div>}
      {online.status === 'idle' && <div className="muted small fp-note">{t('Type at least two letters to search online.')}</div>}
      {rows(online.results)}
    </>}

    {children}
  </div>
}
