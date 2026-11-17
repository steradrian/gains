import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import {
  addCustomUnit, removeCustomUnit, restoreCustomUnit, updateCustomUnit,
  CUSTOM_UNIT_ABBR_MAX, CUSTOM_UNIT_FULL_MAX,
} from '../../../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings, useSheetSave } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import TextField from '../../../ds/TextField.jsx'
import { toastUndoRemove } from './list-undo.js'

export const unitErrorText = code => ({
  abbr: t('Give the unit an abbreviation of up to {0} characters.', CUSTOM_UNIT_ABBR_MAX),
  full: t('The full name can be up to {0} characters.', CUSTOM_UNIT_FULL_MAX),
  builtin: t('That unit is already in the list.'),
  duplicate: t('You already have a unit with that abbreviation.'),
  'full-list': t('That is the most custom units there can be. Remove one first.'),
  missing: t('That unit is already gone.'),
})[code]

/**
 * Custom unit drawer (boards St1CustomUnit, A1.27): a name and an abbreviation. Past diary entries
 * are logged in the abbreviation, so an existing unit can only be renamed; Delete closes with an
 * Undo toast. The board's "Weighs" field is not here: the hub's unit has no weight (`{ abbr, full }`),
 * and a custom unit scales a food by the amount alone.
 */
export function CustomUnitSheet({ unit = null, close }) {
  const { data } = useNtSettings()
  const units = settingOf(data, 'customUnits')
  const editing = unit != null
  const [full, setFull] = useState(editing ? unit.full ?? '' : '')
  const [abbr, setAbbr] = useState('')
  const index = editing ? units.findIndex(u => u.abbr === unit.abbr) : -1
  const entry = units[index]
  const save = useSheetSave(close)
  const del = useSheetSave(() => {
    close()
    if (entry == null) return
    toastUndoRemove({
      message: t('Deleted {0}', unit.full || unit.abbr),
      key: 'customUnits',
      restore: d => restoreCustomUnit(settingOf(d, 'customUnits'), entry, index),
      errorText: unitErrorText,
    })
  })
  const busy = save.busy || del.busy
  const error = save.error || del.error

  const submit = e => {
    e.preventDefault()
    save.submit('customUnits', d => (editing
      ? updateCustomUnit(settingOf(d, 'customUnits'), unit.abbr, { full })
      : addCustomUnit(settingOf(d, 'customUnits'), { abbr, full })), unitErrorText)
  }
  const remove = () => del.submit('customUnits', d => ({ list: removeCustomUnit(settingOf(d, 'customUnits'), unit.abbr) }), unitErrorText)

  return (
    <BottomSheet title={editing ? t('Custom unit') : t('New unit')}>
      <form className="set-form" onSubmit={submit}>
        <TextField label={t('Name')} value={full} onChange={setFull} wide placeholder={t('Handful')}
          inputProps={{ maxLength: CUSTOM_UNIT_FULL_MAX, autoComplete: 'off', autoFocus: true }} />
        <TextField label={t('Abbreviation')} value={editing ? unit.abbr : abbr} onChange={setAbbr} wide placeholder={t('hf')}
          hint={editing ? t('Past entries are logged in this, so it stays as it is.') : undefined}
          inputProps={{ maxLength: CUSTOM_UNIT_ABBR_MAX, disabled: editing, autoComplete: 'off', autoCapitalize: 'none' }} />
        <p className="set-note">{t('It does not convert by weight: 2 units is double the nutrition of 1.')}</p>
        {error && <p className="set-err" role="alert">{error}</p>}
        <Button type="submit" variant="primary" block busy={save.busy} disabled={busy} haptic>{editing ? t('Save unit') : t('Add unit')}</Button>
        {editing && <Button variant="danger" block disabled={busy} onClick={remove}>{t('Delete unit')}</Button>}
      </form>
    </BottomSheet>
  )
}

/** Opens the drawer to add a unit, or to edit `unit` (`{ abbr, full }`). */
export const openCustomUnitSheet = (unit = null) =>
  useUI.getState().openSheet(close => <CustomUnitSheet unit={unit} close={close} />, { variant: 'ds' })
