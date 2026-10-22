import { useMemo, useRef, useState } from 'react'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import TextField from '../ds/TextField.jsx'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { recordFoodDelete } from '../lib/me/food-changes.js'
import { amountEditable, editedItem, newUuid, nutritionOf, timeOf, unitsFor } from '../lib/nutrition/diary.js'
import { removedText, toastLogged, writeErrorText } from '../lib/nutrition/log-feedback.js'
import { mealLabels } from '../lib/nutrition/meal-name.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import Icon from './Icon.jsx'

const num = text => Number(String(text).replace(',', '.')) || 0

// A logged item, to change or remove (board Ea8Entry; NutriTrace's diary edit sheet): the amount
// and unit through the portion logic, the servings, the time and the meal. Save sends one
// editedItem, built once per set of inputs: Save again after a failure sends the same entry (same
// uuid, same stamp), so a save whose answer was lost is not applied twice. A quick-kcal row, or a
// recipe split into its ingredients, has no amount here: its time and meal only. Remove is undone
// from the toast (board Ea8Removed), with the entry back at its place in the day under a new uuid
// (the removed one stays tombstoned in NutriTrace).
export function DiaryItemSheet({ date, item, close }) {
  const units = useUnits()
  const settings = useNutrition(s => s.settings.data)
  const labels = mealLabels(settings)
  const withAmount = amountEditable(item)
  const first = useRef({ portion: Number(item.portion) || 100, unit: item.unit || 'g', servings: Number(item.quantity) || 1, meal: Number(item.meal) || 0, time: timeOf(item) }).current
  const [portion, setPortion] = useState(first.portion)
  const [unit, setUnit] = useState(first.unit)
  const [servings, setServings] = useState(first.servings)
  const [meal, setMeal] = useState(first.meal)
  const [time, setTime] = useState(first.time)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const draft = useMemo(() => {
    try { return editedItem(item, { portion, unit, servings, meal, time }) } catch { return null }
  }, [item, portion, unit, servings, meal, time])
  const dirty = portion !== first.portion || unit !== first.unit || servings !== first.servings || meal !== first.meal || time !== first.time
  const shown = nutritionOf(draft || item)
  const nameOf = slot => labels[slot] ?? t('Meal {0}', slot + 1)
  const wasIn = nameOf(first.meal)

  const mealOptions = labels.map((label, slot) => ({ value: slot, label }))
  if (!mealOptions.some(o => o.value === meal)) mealOptions.push({ value: meal, label: nameOf(meal) })

  async function save() {
    if (!draft || busy || !dirty) return
    setBusy(true)
    setError('')
    try {
      await useNutrition.getState().updateItem(date, draft, item)
      close()
      useUI.getState().toast(t('Updated'))
    } catch (e) {
      if (e?.code === 'changed') {
        close()
        useUI.getState().toast(writeErrorText(e))
        return
      }
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const at = useNutrition.getState().days[date]?.entry?.items?.findIndex(i => i.uuid === item.uuid)
      await useNutrition.getState().removeItem(date, item.uuid)
      const back = { ...item, uuid: newUuid() }
      recordFoodDelete({ date, item, at, backUuid: back.uuid, settings })
      close()
      toastLogged(removedText(date, wasIn, item.name), () => useNutrition.getState().restoreItem(date, back, at >= 0 ? at : null))
    } catch (e) {
      setError(writeErrorText(e))
      setBusy(false)
    }
  }

  const sub = [date === todayISO() ? null : fmtDate(date, true), wasIn, t('logged {0}', first.time), units.energy(shown.calories || 0)].filter(Boolean).join(' · ')
  return <BottomSheet type="half" title={t('Logged food')}
    footer={<div className="g-en-foot">
      <Button variant="danger" disabled={busy} onClick={remove} aria-label={t('Remove {0} from {1}', item.name, wasIn)}>{t('Remove')}</Button>
      <Button variant="primary" haptic busy={busy} disabled={!draft || !dirty} onClick={save}>{busy ? t('Saving…') : t('Save')}</Button>
    </div>}>
    <div className="g-en">
      <div className="g-en-head">
        <span className="g-en-lead" aria-hidden="true"><Icon name={withAmount ? 'apple' : 'bolt'} className="g-icon" /></span>
        <span className="g-en-id">
          <b className="g-en-name">{item.name}</b>
          <span className="g-en-sub">{sub}</span>
        </span>
      </div>
      <div className="g-en-grid">
        {withAmount && <>
          <TextField label={t('Amount')} unit={unit} value={first.portion} inputMode="decimal" onChange={v => setPortion(num(v))} />
          <TextField label={t('Servings')} value={first.servings} inputMode="decimal" onChange={v => setServings(num(v))} />
        </>}
        <TextField label={t('Time')} value={first.time} inputProps={{ type: 'time' }} onChange={setTime} />
        <label className="g-tfield">
          <span className="g-tfield-label">{t('Meal')}</span>
          <span className="g-tfield-box g-en-meal">
            <select value={meal} onChange={e => setMeal(Number(e.target.value))}>
              {mealOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Icon name="chevronDown" className="g-icon" />
          </span>
        </label>
      </div>
      {withAmount && <ChipGroup label={t('Unit')} scroll options={unitsFor(item, settings)} value={unit} onChange={setUnit} />}
      {withAmount && !draft && <p className="g-lf-note" role="status">{t('Enter an amount above 0.')}</p>}
      {error && <p className="g-lf-note g-lf-err" role="alert">{error}</p>}
    </div>
  </BottomSheet>
}

/** Opens a logged item over the page. */
export function diaryItemSheet(props) {
  useUI.getState().openSheet(close => <DiaryItemSheet {...props} close={close} />, { variant: 'ds' })
}
