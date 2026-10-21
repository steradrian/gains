import { useMemo } from 'react'
import Button from '../../ds/Button.jsx'
import SegmentedControl from '../../ds/SegmentedControl.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import { t, tn } from '../../lib/i18n.js'
import { foodKcal } from '../../lib/nutrition/diary.js'
import { dayName } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import Icon from '../Icon.jsx'
import { Loading } from '../Loader.jsx'
import LogFoodRow from '../LogFoodRow.jsx'
import { didYouMean } from './did-you-mean.js'
import LogNoMatch from './LogNoMatch.jsx'
import LogOnlineNote from './LogOnlineNote.jsx'
import LogSavedList from './LogSavedList.jsx'

const SUGGESTED = 5

/** The drawer's frame for this step (ds/BottomSheet props): the search and the tabs stay pinned
 *  while the results scroll; Scan and Create a food stay at the foot. */
export const searchFrame = ctx => {
  const { found, query, setQuery, searchRef, tab, setTab, firstRun } = ctx
  const clear = () => { setQuery(''); ctx.resetLimit(); searchRef.current?.focus() }
  return {
    type: 'full',
    title: t('Log food'),
    chip: dayName(ctx.date) + ' · ' + ctx.mealName,
    onChip: ctx.openMeal,
    head: <>
      <label className="g-lf-search">
        <Icon name="magnifier" className="g-icon" />
        <input ref={searchRef} type="search" value={query} placeholder={t('Search foods')} aria-label={t('Search foods')} autoFocus enterKeyHint="search"
          onChange={e => { setQuery(e.target.value); ctx.resetLimit() }}
          onKeyDown={e => { if (e.key === 'Enter' && found.online.status === 'tap') found.online.ask() }} />
        {/* The × goes once the query does: focus goes back to the field, not out of the drawer. */}
        {query && <button type="button" className="g-lf-clear" onClick={clear} aria-label={t('Clear')}><Icon name="xmark" className="g-icon" /></button>}
      </label>
      {!found.query && <div className="g-lf-tabs">
        <SegmentedControl label={t('Food source')} value={tab} onChange={setTab}
          options={[{ value: 'search', label: t('Search') }, { value: 'meals', label: t('Saved meals') }, { value: 'recipes', label: t('Recipes') }]} />
      </div>}
    </>,
    footer: <div className="g-lf-foot">
      <Button variant={firstRun ? 'primary' : 'secondary'} icon="scanBarcode" onClick={ctx.scan}>{t('Scan')}</Button>
      <Button variant="secondary" onClick={() => ctx.createFood(found.query)}>{t('Create a food')}</Button>
    </div>,
  }
}

// The Log food results (boards Ea8Search, Ea8Saved, Ea8NoMatch, Ea8Offline). With nothing typed:
// Recent and your foods, or the Saved meals and Recipes tabs. Typed: your foods, saved meals and
// Open Food Facts that match, or No match with the way on. A row opens Amount and its + logs one
// serving (with Ask for quantity off, the row logs one serving too).
export default function LogSearchStep({ ctx }) {
  const { found, saved, tab, mealName, settings, firstRun } = ctx
  const { query: q, recents, own, ownTotal, online, foods } = found
  const { energy } = useUnits()
  const allFoods = useNutrition(s => s.foods.list)
  const meals = useNutrition(s => s.meals.list)
  const recipes = useNutrition(s => s.recipes.list)
  const offOn = settingOf(settings, 'offEnabled')

  const failed = foods.status === 'error' && !foods.list.length
  const total = ownTotal + online.results.length
  const announcement = online.status !== 'ready' ? '' : total ? t('Results: {0}', total) : t('No results')

  const noMatch = !!q && !own.length && !saved.all.length && (offOn ? online.status === 'ready' && !online.results.length : true)
  const suggestion = useMemo(
    () => (noMatch ? didYouMean(q, [...allFoods, ...meals, ...recipes].map(x => x.name)) : null),
    [noMatch, q, allFoods, meals, recipes],
  )

  const foodRows = (list, { online: remote = false } = {}) => list.map(f => (
    <LogFoodRow key={f.id ?? f.client_key ?? f.barcode ?? f.name} icon={remote ? 'globe' : 'apple'} title={f.name} tag={remote ? t('OFF') : undefined}
      subtitle={[f.brand, `${f.portion || 100} ${f.unit || 'g'}`, energy(foodKcal(f))].filter(Boolean).join(' · ')}
      onOpen={() => ctx.pick(f)} onAdd={() => ctx.add(f)} addLabel={t('Add {0} to {1}', f.name, mealName)} />
  ))
  const heading = (text, extra) => <h2 className="g-lf-sec">{text}{extra && <span className="g-lf-count">{extra}</span>}</h2>
  const note = text => <p className="g-lf-note">{text}</p>
  const more = (shown, all) => all > shown && <Button variant="ghost" size="sm" onClick={ctx.moreOwn}>{t('Show more')}</Button>
  const quickRow = ctx.showQuick && <LogFoodRow icon="bolt" title={t('Quick kcal')} subtitle={t('Just a number, no food')} onAdd={ctx.quick} />

  let body
  if (q && noMatch) body = <LogNoMatch query={q} online={offOn} suggestion={suggestion} onSuggest={ctx.setQuery}
    onCreate={() => ctx.createFood(q)} onQuick={ctx.showQuick ? ctx.quick : undefined} onScan={ctx.scan} />
  else if (q) body = <>
    {heading(t('Your foods'))}
    {own.length ? foodRows(own) : note(t('None of your foods match.'))}
    {more(own.length, ownTotal)}
    {saved.all.length > 0 && <LogSavedList saved={saved} kind="all" />}
    {offOn && <>
      {heading(t('Open Food Facts'), online.status === 'ready' && online.results.length ? tn('{0} result', '{0} results', online.results.length) : null)}
      <LogOnlineNote online={online} query={q} />
      {online.status === 'ready' && !online.results.length && note(t('Nothing found online.'))}
      {online.status === 'idle' && note(t('Type at least two letters to search online.'))}
      {foodRows(online.results, { online: true })}
    </>}
    {quickRow}
  </>
  else if (tab === 'meals' || tab === 'recipes') body = <LogSavedList saved={saved} kind={tab} />
  else if (foods.status === 'ready' && !foods.list.length) body = <>
    <StageEmpty card={false} illustration="plate" title={t('No foods yet')} body={t('Foods you log show up here. Search to find one.')} />
    {quickRow}
  </>
  else body = <>
    {foods.status === 'loading' && !foods.list.length && <Loading className="g-lf-note" />}
    {firstRun && own.length > 0 && <>{heading(t('Suggested foods'))}{foodRows(own.slice(0, SUGGESTED))}</>}
    {!firstRun && recents.length > 0 && <>{heading(t('Recent'))}{foodRows(recents)}</>}
    {(firstRun ? own.length > SUGGESTED : own.length > 0) && <>{heading(t('Your foods'))}{foodRows(firstRun ? own.slice(SUGGESTED) : own)}{more(own.length, ownTotal)}</>}
    {quickRow}
  </>

  return <div className="g-lf-body">
    <div className="vh" role="status" aria-live="polite">{announcement}</div>
    {failed && <>
      <p className="g-lf-note g-lf-err" role="alert">{t('Your foods did not load.')}</p>
      <Button variant="secondary" size="sm" onClick={() => useNutrition.getState().loadFoods({ force: true })}>{t('Try again')}</Button>
    </>}
    {body}
  </div>
}
