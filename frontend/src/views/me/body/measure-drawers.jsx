import { useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import Switch from '../../../ds/Switch.jsx'
import TextField from '../../../ds/TextField.jsx'
import { todayISO } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { dayName } from '../../../lib/nutrition/log-feedback.js'
import {
  addCustomField, buildEntry, fieldUnit, logFields, measurementOn, saveMeasurementEntry,
  setBuiltinTracked, setCustomTracked, startTexts,
} from '../../../lib/me/measure-log.js'
import { MEASUREMENT_FIELDS, enabledMeasurementFields } from '../../../lib/measurements.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { nameOf } from './MeasurementsTab.jsx'

const toast = message => useUI.getState().toast(message)
const SAME_DATE = () => t('That date already has measurements. Edit it instead.')
const SAVE_ERRORS = {
  date: () => t('Choose a valid date'),
  duplicate: SAME_DATE,
  bodyFat: () => t('Body fat must be between 0 and 100%.'),
  empty: () => t('Enter at least one measurement'),
}

// Board Me2LogMeasure's date: a sub-panel of the drawer with the native date field; Done applies it.
function DatePanel({ date, onPick, close }) {
  const [value, setValue] = useState(date)
  const done = () => { if (value) onPick(value); close() }
  return (
    <BottomSheet title={t('Date')} footer={<Button block onClick={done}>{t('Done')}</Button>}>
      <TextField label={t('Date')} value={date} onChange={setValue} inputProps={{ type: 'date', max: todayISO() }} />
    </BottomSheet>
  )
}

// `sourceDate`: the day being edited, or null for a new check-in. Opening a new one on a day that has
// one already opens that day (`measurementLogSheet` says so), and so does picking such a day.
function LogMeasurements({ sourceDate: first, close }) {
  const S = useStore(s => s.S)
  const [sourceDate, setSourceDate] = useState(first ?? (measurementOn(S, todayISO()) ? todayISO() : null))
  const [date, setDate] = useState(sourceDate || todayISO())
  const source = sourceDate ? measurementOn(S, sourceDate) : null
  const fields = logFields(S, source)
  const [texts, setTexts] = useState(() => startTexts(source, fields, S.unit))

  const pickDate = day => {
    const existing = day !== sourceDate && measurementOn(S, day)
    setDate(day)
    if (!existing) return
    setSourceDate(day)
    setTexts(startTexts(existing, logFields(S, existing), S.unit))
    toast(SAME_DATE())
  }

  const save = () => {
    const built = buildEntry({ S, sourceDate, date, texts, fields })
    if (!built.ok) { toast(SAVE_ERRORS[built.reason]()); return }
    saveMeasurementEntry(built.entry, sourceDate)
    close()
    toast(t('Measurements saved'))
  }

  const openDate = () => useUI.getState().openSheet(back => <DatePanel date={date} onPick={pickDate} close={back} />, { variant: 'ds' })

  return (
    <BottomSheet type="full" title={sourceDate ? t('Edit measurements') : t('Log measurements')}
      chip={dayName(date)} onChip={openDate} chipLabel={t('Change date')}
      footer={<Button block onClick={save} disabled={!fields.length}>{t('Save measurements')}</Button>}>
      {fields.length ? (
        <>
          <p className="bd-hint">{t('Fill only what you measured today. Empty fields stay empty.')}</p>
          <div className="bd-fields">
            {fields.map(f => (
              <TextField key={f.key + ':' + (sourceDate || '')} label={nameOf(f)} unit={fieldUnit(f, S.unit)} value={texts[f.key] ?? ''}
                inputMode="decimal" onChange={text => setTexts(v => ({ ...v, [f.key]: text }))} />
            ))}
          </div>
          <DetailRow icon="gear" title={t('Choose measurements')} onClick={manageMeasurementsSheet} />
        </>
      ) : (
        <StageEmpty tone="light" illustration="chart" card={false} title={t('Choose at least one measurement first.')}
          action={t('Choose measurements')} onClick={manageMeasurementsSheet} />
      )}
    </BottomSheet>
  )
}

/**
 * Board Me2LogMeasure: log a check-in, or edit the one on `sourceDate`. With nothing tracked it opens
 * on Choose measurements first (a sub-panel, so Back lands on the form).
 */
export function measurementLogSheet(sourceDate = null) {
  const S = useStore.getState().S
  if (!sourceDate && measurementOn(S, todayISO())) toast(SAME_DATE())
  const sheet = useUI.getState().openSheet(close => <LogMeasurements sourceDate={sourceDate} close={close} />, { variant: 'ds' })
  if (!sourceDate && !enabledMeasurementFields(S).length) manageMeasurementsSheet()
  return sheet
}

const GROUPS = [...new Set(MEASUREMENT_FIELDS.map(f => f.group))]

function ChooseMeasurements({ close }) {
  const S = useStore(s => s.S)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const enabled = new Set(S.measurementEnabled || [])

  const add = () => {
    const result = addCustomField(name)
    if (result.reason === 'exists') { toast(t('A custom measurement with that name already exists.')); return }
    if (!result.ok) return
    setName('')
    setAdding(false)
  }

  return (
    <BottomSheet type="full" title={t('Choose measurements')} footer={<Button block onClick={close}>{t('Done')}</Button>}>
      <p className="bd-hint">{t('Log measurements shows only the ones you track.')}</p>
      {GROUPS.map(group => (
        <section key={group} className="bd-group" aria-label={t(group)}>
          <h3>{t(group)}</h3>
          {MEASUREMENT_FIELDS.filter(f => f.group === group).map(f => (
            <DetailRow key={f.key} title={t(f.label)}
              trailing={<Switch checked={enabled.has(f.key)} onChange={on => setBuiltinTracked(f.key, on)} ariaLabel={t(f.label)} />} />
          ))}
        </section>
      ))}
      <section className="bd-group" aria-label={t('Your own')}>
        <h3>{t('Your own')}</h3>
        {(S.customMeasurements || []).map(c => (
          <DetailRow key={c.id} title={c.name}
            trailing={<Switch checked={c.enabled !== false} onChange={on => setCustomTracked(c.id, on)} ariaLabel={c.name} />} />
        ))}
        {adding ? (
          <div className="bd-add">
            <TextField label={t('Custom measurement')} value={name} onChange={setName}
              inputProps={{ maxLength: 60, autoFocus: true, enterKeyHint: 'done', onKeyDown: e => { if (e.key === 'Enter') add() } }} />
            <Button onClick={add} disabled={!name.trim()}>{t('Add')}</Button>
          </div>
        ) : (
          <DetailRow icon="plus" title={t('Custom measurement')} onClick={() => setAdding(true)} />
        )}
      </section>
    </BottomSheet>
  )
}

/** Board Me2Fields: switch measurements on and off, add your own. A sub-panel when opened from the log drawer. */
export function manageMeasurementsSheet() {
  return useUI.getState().openSheet(close => <ChooseMeasurements close={close} />, { variant: 'ds' })
}
