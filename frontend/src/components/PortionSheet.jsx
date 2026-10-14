import { useMemo, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { atPortion, nutritionOf, unitsFor } from '../lib/nutrition/diary.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import { writeErrorText, toastLogged } from '../lib/nutrition/log-feedback.js'
import { fmtDate } from '../lib/format.js'
import MacroLine from './MacroLine.jsx'
import { Button, NumberField } from './ui.jsx'

// How much of a food, then Log: NutriTrace's quantity prompt (Foods.svelte). Serving size in any
// unit NutriTrace knows (the food's own household units first), number of servings, and the
// nutrients of that amount as you type. A failed write keeps the sheet and what is in it; Log
// again sends the same entry, so a save whose answer was lost is not logged twice.
export default function PortionSheet({ food, date, meal, mealName, onLogged, close }) {
  const units = useUnits()
  const [portion, setPortion] = useState(Number(food.portion) || 100)
  const [unit, setUnit] = useState(food.unit || 'g')
  const [servings, setServings] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // One draft per amount: the same inputs retry the same entry.
  const draft = useMemo(() => {
    try { return useNutrition.getState().draftFood({ food, meal, portion, unit, servings }) } catch { return null }
  }, [food, meal, portion, unit, servings])
  const scaled = nutritionOf({ ...atPortion(food, portion || food.portion, unit), quantity: servings || 1 })

  const log = async () => {
    if (!draft || busy) return
    setBusy(true)
    setError(null)
    try {
      const item = await useNutrition.getState().logFood(date, draft)
      close()
      if (onLogged) onLogged()
      toastLogged(t('Logged to {0}', mealName), () => useNutrition.getState().removeItem(date, item.uuid))
    } catch (e) {
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  return <div className="portion-sheet">
    <h3 className="nt-sheet-title">{food.name}</h3>
    <div className="muted small nt-sheet-sub">{[food.brand, mealName, fmtDate(date, true)].filter(Boolean).join(' · ')}</div>
    <div className="portion-grid">
      <label className="portion-f">
        <span className="small muted">{t('Serving size')}</span>
        <NumberField value={portion} onChange={setPortion} aria-label={t('Serving size')} />
      </label>
      <label className="portion-f">
        <span className="small muted">{t('Servings')}</span>
        <NumberField value={servings} onChange={setServings} aria-label={t('Servings')} />
      </label>
    </div>
    <div className="chips portion-units" role="radiogroup" aria-label={t('Unit')}>
      {unitsFor(food).map(u => <button key={u} type="button" role="radio" aria-checked={u === unit}
        className={'chip' + (u === unit ? ' on' : '')} onClick={() => setUnit(u)}>{u}</button>)}
    </div>
    <div className="portion-sum">
      <span className="big">{units.energy(scaled.calories || 0)}</span>
      <MacroLine p={scaled.proteins} c={scaled.carbohydrates} f={scaled.fat} />
    </div>
    {!draft && <div className="muted small" role="status">{t('Enter an amount above 0.')}</div>}
    {error && <div className="nt-error small" role="alert">{error}</div>}
    <Button variant="primary" onClick={log} disabled={!draft || busy}>{busy ? t('Saving…') : t('Log')}</Button>
  </div>
}

export function portionSheet(props) {
  useUI.getState().openSheet(close => <PortionSheet {...props} close={close} />)
}
