import { useEffect, useRef, useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import InlineBanner from '../../../ds/InlineBanner.jsx'
import SegmentedControl from '../../../ds/SegmentedControl.jsx'
import TextField from '../../../ds/TextField.jsx'
import { t } from '../../../lib/i18n.js'
import { MACROS } from '../../../lib/nutrition/goals.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUnits } from '../../../lib/nutrition/use-units.js'
import { closeThenNav } from '../../../lib/nav.js'
import { useUI } from '../../../store/useUI.js'
import { confirmDrawer } from '../../settings/confirm-drawer.js'
import { announceSaved, targetsFailureText } from './goal-feedback.js'
import { canSave, draftFor, fixCarbsLabel, initialOf, isDirty, macroLabel, modeNote, modeOptions, warningsOf, warningText } from './targets-data.js'
import { useGoal } from './use-goal.js'
import './goal.css'

// Daily targets (board Me3Targets), a full drawer: the mode, then Calories, Protein, Carbs, Fat and
// Water as fields in the person's units, the warnings that apply, and More options (the old Goals
// page: templates, % macros, per weekday, goal factor, counting workouts). Save goes through
// useGoal().actions.saveTargets, which writes exactly what the Goals page would. Closing with
// unsaved edits asks first: the drawer is locked while there are some, so only its own × and
// Cancel-like buttons leave, and the ask opens inside it as a sub-panel.

const Pending = () => <BottomSheet title={t('Daily targets')} type="full"><i className="g-skel mg-sk" /></BottomSheet>

function Unavailable({ g }) {
  return (
    <BottomSheet title={t('Daily targets')} type="full">
      <p className="mg-error" role="alert">{t('Goals did not load.')}</p>
      {g.status === 'error' && <Button variant="secondary" onClick={() => g.actions.reload?.()}>{t('Try again')}</Button>}
    </BottomSheet>
  )
}

function TargetsDrawer({ close, lock }) {
  const g = useGoal()
  const settings = useNutrition(s => s.settings.data)
  // A save re-reads the settings (status 'loading' with the data still there): the form must stay
  // mounted through it or a refused save would lose what was typed. Only a drawer with no data waits.
  if (!settings) return g.status === 'loading' ? <Pending /> : <Unavailable g={g} />
  return <TargetsForm g={g} settings={settings} close={close} lock={lock} />
}

function TargetsForm({ g, settings, close, lock }) {
  const units = useUnits()
  const [initial] = useState(() => initialOf(settings))
  const [fields, setFields] = useState(initial.fields)
  const [mode, setMode] = useState(initial.draft.mode)
  const [carbsKey, setCarbsKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // `lock` is a new function on every render of the sheet, so the effect holds the latest in a ref.
  const dirty = isDirty(initial, fields, mode)
  const lockRef = useRef(lock)
  lockRef.current = lock
  useEffect(() => {
    lockRef.current(dirty)
    return () => lockRef.current(false)
  }, [dirty])

  const set = (key, value) => { setFields(f => ({ ...f, [key]: value })); setError(null) }
  const warnings = warningsOf(initial, fields, mode)

  const pickMode = next => { if (next !== 'dynamic' || initial.wearable) setMode(next) }

  // Leaving with edits asks first; the ask is a sub-panel of this drawer.
  const leaveDrawer = () => (close.drawer || close)()
  const askThen = go => (dirty
    ? confirmDrawer({
      title: t('Discard changes?'), body: t('Your changes to Daily targets have not been saved.'),
      confirmLabel: t('Discard'), cancelLabel: t('Keep editing'), onConfirm: go,
    })
    : go())

  const submit = async () => {
    if (busy) return
    if (!canSave(initial, fields)) { setError(t('Enter a calorie target.')); return }
    if (!dirty) { close(); return }
    setBusy(true)
    setError(null)
    const res = await g.actions.saveTargets(draftFor(initial, fields, mode), initial.settings)
    setBusy(false)
    if (!res.ok) { setError(targetsFailureText(res.error)); return }
    close()
    if (res.changed) announceSaved(t('Daily targets saved'), res)
  }

  const row = (key, label, unit) => (
    initial.weekday[key]
      ? <DetailRow key={key} title={label} sub={t('Change it in NutriTrace.')} value={t('Varies by weekday')} />
      : <TextField key={key === 'carbohydrates' ? key + carbsKey : key} label={label} unit={unit} value={fields[key]} inputMode="decimal" onChange={v => set(key, v)} />
  )
  const fix = carbsG => { set('carbohydrates', String(carbsG)); setCarbsKey(k => k + 1) }

  return (
    <BottomSheet title={t('Daily targets')} type="full" onClose={() => askThen(leaveDrawer)}
      footer={<Button block busy={busy} onClick={submit}>{t('Save daily targets')}</Button>}>
      <div className="mg-fields">
        <div className="mg-sex">
          <SegmentedControl label={t('Calorie goal')} value={mode} onChange={pickMode} options={modeOptions()} />
          <p className="mg-foot">
            {modeNote(mode)}
            {!initial.wearable && mode !== 'dynamic' && <> {t('Dynamic needs a connected wearable.')}</>}
          </p>
        </div>
        {row('kcal', t('Calories'), initial.units.kcal)}
        {MACROS.map(id => row(id, macroLabel(id), 'g'))}
        {row('water', t('Water'), initial.units.water)}
        {warnings.map(n => (
          <InlineBanner key={n.code} tone="warning" icon="warning" title={warningText(n, units.energy)}
            actions={n.carbsG ? [{ label: fixCarbsLabel(n.carbsG), onClick: () => fix(n.carbsG) }] : undefined} />
        ))}
        {error && <p className="mg-error" role="alert">{error}</p>}
        <div className="mg-rows">
          <DetailRow icon="slider" title={t('More options')} sub={t('Templates, % macros, per weekday, goal factor, counting workouts')}
            onClick={() => askThen(() => closeThenNav(close, '/food/goals'))} />
        </div>
      </div>
    </BottomSheet>
  )
}

/** Opens Daily targets: a drawer from the page, a sub-panel of the drawer it is opened from (How this is worked out). */
export function openTargets() {
  const handle = useUI.getState().openSheet(close => <TargetsDrawer close={close} lock={v => handle.lock(v)} />, { variant: 'ds' })
}
