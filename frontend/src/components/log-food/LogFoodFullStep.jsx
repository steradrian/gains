import { useState } from 'react'
import Button from '../../ds/Button.jsx'
import Tag from '../../ds/Tag.jsx'
import { t } from '../../lib/i18n.js'
import { energyOf } from '../../lib/nutrition/diary.js'
import { fmtAmount, foodErrorText, nutrientLabel, per100Of, per100Unit } from '../../lib/nutrition/foods.js'
import { dayName } from '../../lib/nutrition/log-feedback.js'

// The rows of the table in the order the board draws them; `sub` rows sit under their parent.
const ROWS = [
  { id: 'calories' },
  { id: 'proteins' },
  { id: 'carbohydrates' },
  { id: 'sugars', sub: true },
  { id: 'fat' },
  { id: 'saturated-fat', sub: true },
  { id: 'fiber' },
  { id: 'salt' },
]
const UNIT = { salt: 'g' }
const has = (nutrition, id) => nutrition?.[id] != null && nutrition[id] !== '' && Number.isFinite(Number(nutrition[id]))

/** The drawer's frame for this step (ds/BottomSheet props). */
export const foodFrame = ({ date, mealName, onBack }) => ({
  type: 'full', title: t('Food'), chip: dayName(date) + ' · ' + mealName, onBack, backLabel: t('Back to results'),
})

// A food in full (board Ea8Food): its nutrition per 100 g and per serving, only the rows the
// record has (a nutrient it does not carry shows no row, never a zero), where it comes from, and
// the way on: Log goes to Amount, Save as food keeps an online result in My foods, Edit opens a
// food of yours in the editor. `onLog(food)` is where Log goes (the saved copy after a save),
// `onSave(food)` saves it (throwing on failure) and `onEdit(food)` leaves for the editor.
export default function LogFoodFullStep({ food: given, settings, onLog, onSave, onEdit }) {
  const [food, setFood] = useState(given)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const own = typeof food.id === 'number'
  const per100 = per100Of(food)
  const serving = `${fmtAmount(food.portion ?? 100)} ${food.unit || 'g'}`
  const both = !!per100 && !(Number(food.portion) === 100 && food.unit === per100Unit(food))
  const columns = [...(both ? [{ key: 'per100', label: `100 ${per100Unit(food)}`, nutrition: per100.nutrition }] : []), { key: 'serving', label: serving, nutrition: food.nutrition }]
  const rows = ROWS.filter(r => columns.some(c => has(c.nutrition, r.id)))
  const cell = (nutrition, id) => {
    if (!has(nutrition, id)) return ''
    if (id === 'calories') { const e = energyOf(Number(nutrition[id]), settings); return `${e.value} ${e.unit}` }
    return `${fmtAmount(nutrition[id])} ${UNIT[id] || 'g'}`
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await onSave(food)
      if (saved && typeof saved.id === 'number') setFood(saved)
      setJustSaved(true)
    } catch (e) {
      setError(foodErrorText(e, { write: true }))
    } finally {
      setBusy(false)
    }
  }

  return <div className="g-ff">
    <div className="g-ff-head">
      <b className="g-la-name">{food.name}</b>
      <span className="g-la-sub">
        {[food.brand, own ? t('your food') : t('Open Food Facts'), food.barcode].filter(Boolean).join(' · ')}
      </span>
      {!own && <Tag tone="muted">{t('Online')}</Tag>}
    </div>
    {rows.length > 0 && <table className="g-ff-table">
      <thead>
        <tr>
          <th scope="col"><span className="vh">{t('Nutrient')}</span></th>
          {columns.map(c => <th key={c.key} scope="col">{c.key === 'per100' ? t('Per 100 {0}', per100Unit(food)) : t('Per serving')}<span>{c.label}</span></th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => <tr key={r.id} className={r.sub ? 'g-ff-sub' : undefined}>
          <th scope="row">{nutrientLabel(r.id)}</th>
          {columns.map(c => <td key={c.key}>{cell(c.nutrition, r.id)}</td>)}
        </tr>)}
      </tbody>
    </table>}
    {food.notes && <p className="g-lf-note">{food.notes}</p>}
    {!own && <p className="g-lf-note">{t('Logging it saves it to your foods first, so the entry points at a food you can find again.')}</p>}
    {justSaved && <p className="g-lf-note" role="status">{t('Saved to your foods')}</p>}
    {error && <p className="g-lf-note g-lf-err" role="alert">{error}</p>}
    <div className="g-ff-acts">
      {own && onEdit && <Button variant="secondary" onClick={() => onEdit(food)}>{t('Edit')}</Button>}
      {!own && onSave && <Button variant="secondary" busy={busy} onClick={save}>{t('Save as food')}</Button>}
      <Button variant="primary" onClick={() => onLog(food)}>{t('Log')}</Button>
    </div>
  </div>
}
