import { useMemo, useRef, useState } from 'react'
import Button from '../../ds/Button.jsx'
import { fmtDate, todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { addedText, toastLogged, writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { NumberField, TextField } from '../ui.jsx'

const KJ_PER_KCAL = 4.184

/** The drawer's frame for this step (ds/BottomSheet props). */
export const quickFrame = ({ date, mealName, onBack }) => ({
  type: 'auto', title: t('Quick calories'), chip: date === todayISO() ? mealName : fmtDate(date, true) + ' · ' + mealName,
  chipIcon: 'utensils', onBack, backLabel: t('Back to results'),
})

// Quick calories (board Ea8Quick): energy with no food behind it, in the person's unit (kJ is
// stored as kcal), an optional name and the macros you know. It lands on the diary entry only and
// stays out of My foods. A failed write keeps the step and its numbers.
// `pending` ({ uuid }): the entry a failed write may still have saved, shared by the steps of one
// picker; while it is set the next log reuses that uuid, so an edit after a lost answer updates
// the entry instead of adding a second one.
export default function LogQuickStep({ date, meal, mealName, onLogged, pending: shared, close }) {
  const units = useUnits()
  const own = useRef({ uuid: null })
  const pending = shared || own.current
  const [energy, setEnergy] = useState(null)
  const [name, setName] = useState('')
  const [p, setP] = useState(null)
  const [c, setC] = useState(null)
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const kcal = energy == null ? null : units.energyUnit === 'kJ' ? energy / KJ_PER_KCAL : energy
  // One draft per set of numbers: Add again after a failure sends the same entry.
  const draft = useMemo(() => {
    try {
      const d = useNutrition.getState().draftQuick({ kcal, name, proteins: p, carbohydrates: c, fat: f, meal })
      return pending.uuid ? { ...d, uuid: pending.uuid } : d
    } catch { return null }
  }, [kcal, name, p, c, f, meal, pending])

  const log = async () => {
    if (!draft || busy) return
    setBusy(true)
    setError(null)
    try {
      const item = await useNutrition.getState().logQuick(date, draft)
      pending.uuid = null
      close()
      if (onLogged) onLogged()
      toastLogged(addedText(date, mealName), () => useNutrition.getState().removeItem(date, item.uuid))
    } catch (e) {
      pending.uuid = draft.uuid
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  const field = (label, control) => <label className="g-lq-f"><span>{label}</span>{control}</label>
  return <div className="g-lq">
    {field(units.energyUnit, <NumberField value={energy} onChange={setEnergy} nullable decimal={false} aria-label={units.energyUnit} autoFocus />)}
    <div className="g-lq-row">
      {field(`${t('Protein')} (g)`, <NumberField value={p} onChange={setP} nullable aria-label={t('Protein')} />)}
      {field(`${t('Carbs')} (g)`, <NumberField value={c} onChange={setC} nullable aria-label={t('Carbs')} />)}
      {field(`${t('Fat')} (g)`, <NumberField value={f} onChange={setF} nullable aria-label={t('Fat')} />)}
    </div>
    {field(t('Name (optional)'), <TextField value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label={t('Name (optional)')} />)}
    <p className="g-lf-note">{t('Macros are optional. It counts toward {0} and stays out of My foods.', date === todayISO() ? t('today') : fmtDate(date, true))}</p>
    {error && <p className="g-lf-note g-lf-err" role="alert">{error}</p>}
    <Button variant="primary" onClick={log} disabled={!draft || busy}>{busy ? t('Saving…') : t('Add to {0}', mealName)}</Button>
  </div>
}
