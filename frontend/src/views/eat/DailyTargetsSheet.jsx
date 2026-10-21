import { useState } from 'react'
import { useUI } from '../../store/useUI.js'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import { t } from '../../lib/i18n.js'
import { energyOf } from '../../lib/nutrition/diary.js'
import { MACROS, energyFromUnit, macroGrams, waterFromUnit, waterToUnit, waterUnitOf } from '../../lib/nutrition/goals.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useGoalsForm } from '../../lib/nutrition/use-goals-form.js'

const WATER_LABEL = { ml: 'ml', oz: 'fl oz', L: 'L', G: 'G' }
const macroLabel = id => (id === 'proteins' ? t('Protein') : id === 'carbohydrates' ? t('Carbs') : t('Fat'))

const parse = text => {
  const n = Number(String(text).replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

// Daily targets (board Ea1Targets), a half drawer: calories, protein, carbs, fat and water,
// prefilled from what the person already has set (the goals page's own draft, so a save writes
// through the same path, lib/nutrition/goals.js writesFor). "Worked out from My goal" is left out:
// the app has no My goal inputs to work them out from. Start tracking food saves and closes; the
// Eat root, which shows the invitation only while no goal is set, then reads the goal and draws
// itself.
export default function DailyTargetsSheet({ close }) {
  const form = useGoalsForm()
  const { draft, settings, patch } = form
  const [text, setText] = useState(null)
  const unit = energyOf(0, settings).unit
  const waterUnit = waterUnitOf(settings)

  // The fields start from the first settings that arrive and are the person's from then on.
  if (draft && !text) {
    const kcal = draft.kcal == null ? '' : String(energyOf(draft.kcal, settings).value)
    const macros = Object.fromEntries(MACROS.map(id => [id, macroGrams(draft.macros[id], id, draft.kcal ?? 0)]))
    setText({
      kcal,
      ...Object.fromEntries(MACROS.map(id => [id, macros[id] == null ? '' : String(macros[id])])),
      water: draft.waterMl ? String(waterToUnit(draft.waterMl, waterUnit)) : '',
    })
  }

  const set = (key, value) => setText(v => ({ ...v, [key]: value }))
  const change = (key, value) => {
    set(key, value)
    const n = parse(value)
    if (key === 'kcal') patch({ kcal: n == null ? null : energyFromUnit(n, settings) })
    else if (key === 'water') patch({ waterMl: n == null ? null : waterFromUnit(n, waterUnit) })
    else patch(d => ({ macros: { ...d.macros, [key]: { ...d.macros[key], value: n, percent: false } } }))
  }

  const ready = !!text
  const canSave = ready && parse(text.kcal) != null && form.save.state !== 'saving'
  const start = async () => { if (await form.submit()) close() }
  const fields = ready ? [
    ['kcal', t('Calories'), unit],
    ...MACROS.map(id => [id, macroLabel(id), 'g']),
    ['water', t('Water'), WATER_LABEL[waterUnit]],
  ] : []

  return (
    <BottomSheet
      title={t('Daily targets')}
      type="half"
      footer={<>
        {form.save.state === 'error' && <p className="g-bs-note" role="alert">{writeErrorText(form.save.error)}</p>}
        <Button variant="primary" block disabled={!canSave} busy={form.save.state === 'saving'} onClick={start}>{t('Start tracking food')}</Button>
      </>}
    >
      {form.status === 'error' && !ready
        ? <p className="g-bs-note" role="alert">{t('Goals did not load.')}</p>
        : <div className="g-tgt">
          {fields.map(([key, label, suffix]) => (
            <label key={key}>
              <span>{label} <span aria-hidden="true">({suffix})</span></span>
              <input type="text" inputMode="decimal" value={text[key]} onChange={e => change(key, e.target.value)}
                aria-label={t('{0} ({1})', label, suffix)} />
            </label>
          ))}
        </div>}
    </BottomSheet>
  )
}

/** Opens Daily targets over the Eat root. */
export function dailyTargetsSheet() {
  useUI.getState().openSheet(close => <DailyTargetsSheet close={close} />, { variant: 'ds' })
}
