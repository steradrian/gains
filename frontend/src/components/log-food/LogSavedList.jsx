import { useState } from 'react'
import Button from '../../ds/Button.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import { t } from '../../lib/i18n.js'
import { Loading } from '../Loader.jsx'
import LogFoodRow from '../LogFoodRow.jsx'

const SHOWN = 8

// Your saved meals or recipes in the Log food drawer (board Ea8Saved). A saved meal logs all its
// foods in one tap, a recipe asks for the servings (useSavedMeals.pick). `kind` is 'meals',
// 'recipes' or 'all' (the groups under a typed search), each under its heading. Empty and failed
// lists say so, with the way on.
export default function LogSavedList({ saved, kind }) {
  const [limit, setLimit] = useState(SHOWN)
  const list = saved.all.filter(m => (kind === 'all' ? true : kind === 'recipes' ? m.is_recipe : !m.is_recipe))
  const row = m => {
    const kcal = saved.kcal(m)
    return <LogFoodRow key={saved.key(m)} icon={m.is_recipe ? 'cookingPot' : 'salad'} title={m.name} busy={saved.busy}
      subtitle={saved.subtitle(m) + ' · ' + kcal.value + ' ' + kcal.unit} onAdd={() => saved.pick(m)} />
  }
  const group = (entries, title) => entries.length > 0 && <>
    <h2 className="g-lf-sec">{title}</h2>
    {entries.slice(0, limit).map(row)}
  </>

  if (saved.failed && !saved.all.length) return <>
    <p className="g-lf-note g-lf-err" role="alert">{saved.errorText}</p>
    <Button variant="secondary" size="sm" onClick={saved.retry}>{t('Try again')}</Button>
  </>
  if (!list.length) {
    if (saved.loading) return <Loading className="g-lf-note" />
    return <StageEmpty card={false} illustration="plate"
      title={kind === 'recipes' ? t('No recipes yet') : t('No saved meals yet')}
      body={kind === 'recipes' ? t('A recipe you save shows up here and asks how many servings you had.') : t('A meal you save shows up here and logs all its foods in one tap.')} />
  }
  return <>
    {kind === 'all'
      ? <>{group(list.filter(m => !m.is_recipe), t('Saved meals · one tap logs all'))}{group(list.filter(m => m.is_recipe), t('Recipes · asks for servings'))}</>
      : group(list, kind === 'recipes' ? t('Recipes · asks for servings') : t('Saved meals · one tap logs all'))}
    {list.length > limit && <Button variant="ghost" size="sm" onClick={() => setLimit(n => n + SHOWN)}>{t('Show more')}</Button>}
  </>
}
