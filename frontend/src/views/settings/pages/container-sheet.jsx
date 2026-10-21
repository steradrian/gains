import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { addContainer, removeContainer, updateContainer, WATER_CONTAINER_ML_MAX, WATER_CONTAINER_NAME_MAX } from '../../../lib/nutrition/settings-lists.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { settingOf, useSheetSave } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import TextField from '../../../ds/TextField.jsx'
import { restoreList } from './list-undo.js'

const UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'fl oz' },
  { value: 'L', label: 'L' },
  { value: 'G', label: 'G' },
]

const errorOf = code => ({
  name: t('Give the container a name of up to {0} characters.', WATER_CONTAINER_NAME_MAX),
  volume: t('Enter a volume between 1 ml and {0} ml.', WATER_CONTAINER_ML_MAX.toLocaleString()),
  full: t('That is the most containers there can be. Remove one first.'),
  gone: t('That container is not there any more.'),
})[code]

const containersOf = data => settingOf(data, 'waterContainers')

// Water → a container (boards St1Container, A1.21): a name and a volume in the unit you pick,
// stored as whole ml. `container` is the one being edited; without it the sheet adds one. An edit
// opens in ml, which is exactly what is stored; an add opens in the water unit. A refused save
// keeps the sheet and what was typed. Remove has no confirm: it is undone from the toast.
export function ContainerSheet({ container = null, close }) {
  const [name, setName] = useState(container?.name ?? '')
  const [amount, setAmount] = useState(container ? String(container.volumeMl) : '')
  const [unit, setUnit] = useState(() => (container ? 'ml' : settingOf(useNutrition.getState().settings.data, 'waterUnit')))
  const { busy, error, submit } = useSheetSave(close)
  const typed = { name, amount: Number(amount.replace(',', '.')), unit }
  const save = () => submit('waterContainers', data => {
    const now = settingOf(data, 'waterContainers')
    return container ? updateContainer(now, container.id, typed) : addContainer(now, typed)
  }, errorOf)
  const remove = async () => {
    let outcome = null
    const done = await submit('waterContainers', data => {
      const now = settingOf(data, 'waterContainers')
      if (!now.some(c => String(c.id) === String(container.id))) return { error: 'gone' }
      outcome = { before: now, after: removeContainer(now, container.id) }
      return { list: outcome.after }
    }, errorOf)
    if (done && outcome) {
      useUI.getState().toast(t('Removed {0}', container.name), {
        action: t('Undo'),
        onAction: () => restoreList('waterContainers', outcome.before, outcome.after, containersOf),
      })
    }
  }

  return (
    <BottomSheet title={container ? container.name : t('New container')}>
      <div className="set-sheet">
        <TextField label={t('Name')} value={name} onChange={setName} placeholder={t('Your gym bottle, a mug')} inputProps={{ maxLength: WATER_CONTAINER_NAME_MAX, autoFocus: !container }} />
        <TextField label={t('Holds')} value={amount} onChange={setAmount} inputMode="decimal" unit={UNITS.find(u => u.value === unit).label} />
        <ChipGroup label={t('Unit')} value={unit} options={UNITS} onChange={setUnit} />
        {error && <InlineBanner role="alert" tone="warning" icon="warning" title={error} />}
        <Button variant="primary" block haptic busy={busy} onClick={save}>{container ? t('Save container') : t('Add container')}</Button>
        {container && <Button variant="danger" block icon="trash" disabled={busy} onClick={remove}>{t('Remove container')}</Button>}
      </div>
    </BottomSheet>
  )
}

export const openContainerSheet = container => useUI.getState().openSheet(close => <ContainerSheet container={container} close={close} />, { variant: 'ds' })
