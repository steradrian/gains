import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { foodKcal } from '../lib/nutrition/diary.js'
import { dayName } from '../lib/nutrition/log-feedback.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { OWN_SHOWN, useFoodSearch } from '../lib/nutrition/use-food-search.js'
import { settingOf } from '../lib/nutrition/use-nt-settings.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import { foodEditSheet } from './FoodEditSheet.jsx'
import Icon from './Icon.jsx'
import { Loading } from './Loader.jsx'
import LogFoodRow from './LogFoodRow.jsx'
import { pickMealSheet, useSheetTarget } from './LoggingTo.jsx'
import OnlineStatus from './OnlineStatus.jsx'
import { scanSheet } from './ScanSheet.jsx'
import { useFoodPick } from './use-food-pick.js'
import { useSavedMeals } from './use-saved-meals.js'

const SUGGESTED = 5
const SAVED_SHOWN = 8

// Log food (board T1.4): the drawer for the selected date and meal, which the chip names and
// changes (the meal; the date is the one it opened on, so a drawer open across midnight still logs
// to its day). Search stays pinned while the results scroll. With nothing typed, Recent, Saved
// meals and My foods; typed, your foods, saved meals and Open Food Facts that match. Scan and
// Create a food at the foot. It closes once something is logged, and the toast says where.
// `date` and `meal` (a Day page's past day) log there without moving the shared selection.
export default function FoodPickerSheet({ close, date: day = null, meal: slot = null }) {
  const target = useSheetTarget({ date: day, meal: slot })
  const { date, meal, mealName } = target
  const log = { date, meal, mealName, onLogged: close }
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('recent')
  const [limit, setLimit] = useState(OWN_SHOWN)
  const [savedLimit, setSavedLimit] = useState(SAVED_SHOWN)
  // The search opens focused: the drawer stands on the keyboard (lib/sheet-keyboard.js) so Scan and
  // Create a food at its foot stay in reach while the person types.
  const search = useRef(null)
  const { query: q, recents, own, ownTotal, online, foods } = useFoodSearch(query, { limit })
  const { pick, quick, showQuick } = useFoodPick(log)
  const saved = useSavedMeals({ query: q, ...log })
  const settings = useNutrition(s => s.settings.data)
  const { energy } = useUnits()
  useEffect(() => { useNutrition.getState().loadSettings() }, [])

  // No recent foods (a first log): Recent offers your most used foods as suggestions, and Scan
  // leads at the foot.
  const firstRun = foods.status === 'ready' && !recents.length
  const failed = foods.status === 'error' && !foods.list.length
  const total = ownTotal + online.results.length
  const announcement = online.status !== 'ready' ? '' : total ? t('Results: {0}', total) : t('No results')

  const foodRows = (list, icon) => list.map(f => <LogFoodRow key={f.id ?? f.client_key} icon={icon} title={f.name} onAdd={() => pick(f)}
    subtitle={[f.brand, `${f.portion || 100} ${f.unit || 'g'}`, energy(foodKcal(f))].filter(Boolean).join(' · ')} />)
  const note = text => <p className="g-lf-note">{text}</p>
  const heading = text => <h2 className="g-lf-sec">{text}</h2>
  const more = (shown, all, onMore) => all > shown && <Button variant="ghost" size="sm" onClick={onMore}>{t('Show more')}</Button>

  const savedRows = () => <>
    {saved.failed && !saved.all.length && <>
      <p className="g-lf-note g-lf-err" role="alert">{saved.errorText}</p>
      <Button variant="secondary" size="sm" onClick={saved.retry}>{t('Try again')}</Button>
    </>}
    {saved.all.slice(0, savedLimit).map(m => {
      const kcal = saved.kcal(m)
      return <LogFoodRow key={saved.key(m)} icon={m.is_recipe ? 'cookingPot' : 'salad'} title={m.name} busy={saved.busy}
        subtitle={saved.subtitle(m) + ' · ' + kcal.value + ' ' + kcal.unit} onAdd={() => saved.pick(m)} />
    })}
    {more(savedLimit, saved.all.length, () => setSavedLimit(n => n + SAVED_SHOWN))}
  </>

  const quickRow = showQuick && <LogFoodRow icon="bolt" title={t('Quick kcal')} subtitle={t('Just a number, no food')} onAdd={quick} />

  let body
  if (q) body = <>
    {heading(t('Your foods'))}
    {own.length ? foodRows(own) : note(t('None of your foods match.'))}
    {more(own.length, ownTotal, () => setLimit(n => n + OWN_SHOWN))}
    {saved.all.length > 0 && <>{heading(t('Saved meals'))}{savedRows()}</>}
    {settingOf(settings, 'offEnabled') && <>
      {heading(t('Open Food Facts'))}
      <OnlineStatus online={online} query={q} />
      {online.status === 'ready' && !online.results.length && note(t('Nothing found online.'))}
      {online.status === 'idle' && note(t('Type at least two letters to search online.'))}
      {foodRows(online.results, 'globe')}
    </>}
    {quickRow}
  </>
  else if (tab === 'saved') body = saved.all.length || saved.failed ? savedRows()
    : saved.loading ? <Loading className="g-lf-note" /> : note(t('No saved meals yet'))
  else if (tab === 'mine') body = <>
    {foods.status === 'loading' && !foods.list.length && <Loading className="g-lf-note" />}
    {foods.status === 'ready' && !foods.list.length && note(t('Foods you log show up here. Search to find one.'))}
    {foodRows([...recents, ...own])}
    {more(own.length, ownTotal, () => setLimit(n => n + OWN_SHOWN))}
  </>
  else body = <>
    {foods.status === 'loading' && !foods.list.length && <Loading className="g-lf-note" />}
    {firstRun && own.length > 0 && <>{heading(t('Suggested foods'))}{foodRows(own.slice(0, SUGGESTED))}</>}
    {firstRun && !own.length && note(t('Foods you log show up here. Search to find one.'))}
    {foodRows(recents)}
    {quickRow}
  </>

  return <BottomSheet type="full" title={t('Log food')} chip={dayName(date) + ' · ' + mealName} onChip={() => pickMealSheet(target)}
    head={<>
      <label className="g-lf-search">
        <Icon name="magnifier" className="g-icon" />
        <input ref={search} type="search" value={query} placeholder={t('Search foods')} aria-label={t('Search foods')} autoFocus enterKeyHint="search"
          onChange={e => { setQuery(e.target.value); setLimit(OWN_SHOWN) }}
          onKeyDown={e => { if (e.key === 'Enter' && online.status === 'tap') online.ask() }} />
        {/* The × goes once the query does: focus goes back to the field, not out of the drawer. */}
        {query && <button type="button" className="g-lf-clear" onClick={() => { setQuery(''); setLimit(OWN_SHOWN); search.current?.focus() }} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
      </label>
      {!q && <div className="g-lf-tabs">
        <SegmentedControl label={t('Food source')} value={tab} onChange={setTab}
          options={[{ value: 'recent', label: t('Recent') }, { value: 'saved', label: t('Saved meals') }, { value: 'mine', label: t('My foods') }]} />
      </div>}
    </>}
    footer={<div className="g-lf-foot">
      <Button variant={firstRun ? 'primary' : 'secondary'} icon="scanBarcode" onClick={() => scanSheet(log)}>{t('Scan')}</Button>
      <Button variant="secondary" onClick={() => foodEditSheet({ food: { name: q }, settings, onSaved: pick })}>{t('Create a food')}</Button>
    </div>}>
    <div className="g-lf-body">
      <div className="vh" role="status" aria-live="polite">{announcement}</div>
      {failed && <>
        <p className="g-lf-note g-lf-err" role="alert">{t('Your foods did not load.')}</p>
        <Button variant="secondary" size="sm" onClick={() => useNutrition.getState().loadFoods({ force: true })}>{t('Try again')}</Button>
      </>}
      {body}
    </div>
  </BottomSheet>
}

/** Log food, to the shared selection's day and meal, or to `date` (and `meal`) when given. */
export function foodPickerSheet({ date = null, meal = null } = {}) {
  useUI.getState().openSheet(close => <FoodPickerSheet close={close} date={date} meal={meal} />, { variant: 'ds' })
}
