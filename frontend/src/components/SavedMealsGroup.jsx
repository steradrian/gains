import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { Tag, ItemRow, SectionTitle } from './blocks.jsx'
import { Button } from './ui.jsx'
import { useSavedMeals } from './use-saved-meals.js'

const SHOWN = 8

// The "Saved meals" group of the inline food picker (FoodSearch): your saved meals and recipes,
// logged to `date`/`meal` in one tap (useSavedMeals).
export default function SavedMealsGroup({ query, date, meal, mealName, onLogged }) {
  const saved = useSavedMeals({ query, date, meal, mealName, onLogged })
  const [limit, setLimit] = useState(SHOWN)
  const { all, failed, busy } = saved
  if (!all.length && !failed) return null

  const row = entry => {
    const kcal = saved.kcal(entry)
    return <ItemRow key={saved.key(entry)} className="food-row" title={entry.name} subtitle={saved.subtitle(entry)}
      trailing={<Tag>{kcal.value} {kcal.unit}</Tag>} onOpen={() => saved.pick(entry)}
      openProps={{ 'aria-busy': busy || undefined, 'aria-disabled': busy || undefined }} />
  }

  return <>
    <SectionTitle>{t('Saved meals')}</SectionTitle>
    {failed && !all.length
      ? <>
        <div className="nt-error small" role="alert">{saved.errorText}</div>
        <Button size="sm" variant="tinted" onClick={saved.retry}>{t('Try again')}</Button>
      </>
      : <div className="list">{all.slice(0, limit).map(row)}</div>}
    {all.length > limit && <Button size="sm" variant="tinted" onClick={() => setLimit(n => n + SHOWN)}>{t('Show more')}</Button>}
  </>
}
