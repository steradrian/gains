import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import ChipGroup from '../../ds/ChipGroup.jsx'
import TextField from '../../ds/TextField.jsx'
import DurationWheel from '../../components/DurationWheel.jsx'
import { fmtNum, todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { ACTIVITY_TYPES, DEFAULT_MINUTES, MAX_MINUTES, bodyWeightOf, estimateKcal, parseAmount, saveActivity } from '../../lib/nutrition/activity.js'
import { energyOf } from '../../lib/nutrition/diary.js'
import { energyFromUnit } from '../../lib/nutrition/goals.js'
import { dayName, writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import './burned.css'

const typeLabel = id => ({
  run: t('Run'), ride: t('Ride'), swim: t('Swim'), football: t('Football'), class: t('Class'), other: t('Other'),
})[id]

// What the Burned number was worked out from, by type; "Other" has no activity to name.
const basisText = (id, weight, duration) => ({
  run: t('Worked out from {0} and {1} of running', weight, duration),
  ride: t('Worked out from {0} and {1} of cycling', weight, duration),
  swim: t('Worked out from {0} and {1} of swimming', weight, duration),
  football: t('Worked out from {0} and {1} of football', weight, duration),
  class: t('Worked out from {0} and {1} of class', weight, duration),
  other: t('Worked out from {0} and {1}', weight, duration),
})[id]

// Log activity (board Ea7Activity), a full drawer: the type, how long on the duration wheel, how
// far, and Burned. Burned starts as weight x minutes x the type's effort and follows the type and
// the wheel until the person types their own; with no weigh-in there is nothing to work it out
// from, so the field starts empty and the line under it is left out. Save writes the activity
// through lib/nutrition/activity.js and closes the drawer, which leaves the person on Burned.
export default function ActivitySheet({ date, type: startType, minutes: startMinutes, close }) {
  const S = useStore(s => s.S)
  const settings = useNutrition(s => s.settings.data)
  const [type, setType] = useState(startType)
  const [sec, setSec] = useState(startMinutes * 60)
  const [distance, setDistance] = useState('')
  const [own, setOwn] = useState(null)   // what the person typed in Burned, or null while it is the estimate
  const [save, setSave] = useState({ state: 'idle', error: null })
  const read = useRef(null)

  const weight = bodyWeightOf(S)
  const minutes = Math.max(1, Math.round(sec / 60))
  const estimate = estimateKcal({ type, kg: weight?.kg, minutes })
  const burned = own ?? (estimate == null ? '' : String(energyOf(estimate, settings).value))
  const burnedNumber = parseAmount(burned)
  const distanceNumber = distance.trim() === '' ? null : parseAmount(distance)
  const canSave = burnedNumber != null && (distance.trim() === '' || distanceNumber != null) && save.state !== 'saving'

  const submit = async () => {
    if (!canSave) return
    setSave({ state: 'saving', error: null })
    const done = Math.max(1, Math.round((read.current ? read.current() : sec) / 60))
    try {
      await saveActivity({ date, name: typeLabel(type), kcal: energyFromUnit(burnedNumber, settings), minutes: done, distance: distanceNumber })
      close()
    } catch (error) {
      setSave({ state: 'error', error })
    }
  }

  return (
    <BottomSheet
      title={t('Log activity')}
      type="full"
      chip={dayName(date)}
      footer={<>
        {save.state === 'error' && <p className="g-bs-note" role="alert">{writeErrorText(save.error)}</p>}
        <Button variant="primary" block disabled={!canSave} busy={save.state === 'saving'} onClick={submit}>{t('Save activity')}</Button>
      </>}
    >
      <div className="g-act">
        <ChipGroup label={t('Type')} value={type} onChange={setType} options={ACTIVITY_TYPES.map(x => ({ value: x.id, label: typeLabel(x.id) }))} />
        <div>
          <p className="g-act-label">{t('How long')}</p>
          <DurationWheel value={sec} onChange={setSec} min={60} max={MAX_MINUTES * 60} readRef={read} />
        </div>
        <div className="g-act-fields">
          <TextField label={t('Distance')} unit={t('km')} inputMode="decimal" value={distance} onChange={setDistance} />
          <TextField
            key={type + minutes}
            label={t('Burned')}
            unit={energyOf(0, settings).unit}
            inputMode="decimal"
            value={burned}
            onChange={v => setOwn(v)}
          />
        </div>
        {own == null && weight && estimate != null && (
          <p className="g-act-hint">
            {basisText(type, fmtNum(weight.shown) + ' ' + weight.unit,t('{0} min', fmtNum(minutes)))}. {t('Change it if your watch says otherwise.')}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}

/** Opens Log activity over the Burned page: a run of `minutes` unless told otherwise. */
export function logActivitySheet({ date = todayISO(), type = 'run', minutes = DEFAULT_MINUTES } = {}) {
  useUI.getState().openSheet(close => <ActivitySheet date={date} type={type} minutes={minutes} close={close} />, { variant: 'ds' })
}
