import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { addCustomNutrient, CUSTOM_NUTRIENT_LABEL_MAX, NUTRIENT_UNITS } from '../lib/nutrition/settings-lists.js'
import { settingOf, useSheetSave } from '../lib/nutrition/use-nt-settings.js'
import { Button, TextField } from './ui.jsx'
import { Chip, ChipRow } from './blocks.jsx'
import { SheetHeader } from './sheet-layout.jsx'

const errorOf = code => ({
  name: t('Give the nutrient a name of up to {0} characters.', CUSTOM_NUTRIENT_LABEL_MAX),
  long: t('That name is too long. Shorten it.'),
  unit: t('Pick a unit.'),
  duplicate: t('You already have a nutrient with that name.'),
  full: t('That is the most custom nutrients there can be. Remove one first.'),
})[code]

// NutriTrace's "Add custom nutrient" (Nutrients.svelte): a name, which makes its id, and a unit.
// A refused save keeps the sheet and what was typed.
export default function CustomNutrientSheet({ close }) {
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('g')
  const { busy, error, submit } = useSheetSave(close)
  const add = () => submit('customNutriments', data => addCustomNutrient(settingOf(data, 'customNutriments'), { label, unit }), errorOf)

  return <div className="quick-sheet">
    <SheetHeader title={t('Add a custom nutrient')} />
    <label className="portion-f">
      <span className="small muted">{t('Name')}</span>
      <TextField value={label} maxLength={CUSTOM_NUTRIENT_LABEL_MAX} placeholder={t('Omega-3')}
        onChange={e => setLabel(e.target.value)} aria-label={t('Name')} autoFocus />
    </label>
    <span className="small muted">{t('Unit')}</span>
    <ChipRow role="group" aria-label={t('Unit')}>
      {NUTRIENT_UNITS.map(u => <Chip key={u} on={u === unit} nocap onClick={() => setUnit(u)}>{u}</Chip>)}
    </ChipRow>
    {error && <div className="nt-error small" role="alert">{error}</div>}
    <Button variant="primary" onClick={add} disabled={busy}>{busy ? t('Saving…') : t('Add')}</Button>
  </div>
}

export function customNutrientSheet() {
  useUI.getState().openSheet(close => <CustomNutrientSheet close={close} />)
}
