import { useMemo, useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { fmtDate } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { writeErrorText, toastLogged } from '../lib/nutrition/log-feedback.js'
import { Button, NumberField, TextField } from './ui.jsx'

// NutriTrace's Quick Calories (QuickCaloriesSheet.svelte): a number of kcal with no food behind
// it, an optional name and the macros you know. A failed write keeps the sheet and its numbers.
export default function QuickKcalSheet({ date, meal, mealName, onLogged, close }) {
  const [kcal, setKcal] = useState(null)
  const [name, setName] = useState('')
  const [p, setP] = useState(null)
  const [c, setC] = useState(null)
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // One draft per set of numbers: Log again after a failure sends the same entry.
  const draft = useMemo(() => {
    try { return useNutrition.getState().draftQuick({ kcal, name, proteins: p, carbohydrates: c, fat: f, meal }) } catch { return null }
  }, [kcal, name, p, c, f, meal])

  const log = async () => {
    if (!draft || busy) return
    setBusy(true)
    setError(null)
    try {
      const item = await useNutrition.getState().logQuick(date, draft)
      close()
      if (onLogged) onLogged()
      toastLogged(t('Logged to {0}', mealName), () => useNutrition.getState().removeItem(date, item.uuid))
    } catch (e) {
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  return <div className="quick-sheet">
    <h3 className="nt-sheet-title">{t('Quick kcal')}</h3>
    <div className="muted small nt-sheet-sub">{mealName} · {fmtDate(date, true)}</div>
    <label className="portion-f">
      <span className="small muted">{t('kcal')}</span>
      <NumberField value={kcal} onChange={setKcal} nullable decimal={false} aria-label={t('kcal')} autoFocus />
    </label>
    <label className="portion-f">
      <span className="small muted">{t('Name (optional)')}</span>
      <TextField value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label={t('Name (optional)')} />
    </label>
    <div className="portion-grid">
      <label className="portion-f"><span className="small muted">{t('Protein')} (g)</span>
        <NumberField value={p} onChange={setP} nullable aria-label={t('Protein')} /></label>
      <label className="portion-f"><span className="small muted">{t('Carbs')} (g)</span>
        <NumberField value={c} onChange={setC} nullable aria-label={t('Carbs')} /></label>
      <label className="portion-f"><span className="small muted">{t('Fat')} (g)</span>
        <NumberField value={f} onChange={setF} nullable aria-label={t('Fat')} /></label>
    </div>
    {error && <div className="nt-error small" role="alert">{error}</div>}
    <Button variant="primary" onClick={log} disabled={!draft || busy}>{busy ? t('Saving…') : t('Log')}</Button>
  </div>
}

export function quickKcalSheet(props) {
  useUI.getState().openSheet(close => <QuickKcalSheet {...props} close={close} />)
}
