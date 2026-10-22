import { useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import GlassValueRow from '../../../ds/GlassValueRow.jsx'
import RadioRow from '../../../ds/RadioRow.jsx'
import SegmentedControl from '../../../ds/SegmentedControl.jsx'
import TextField from '../../../ds/TextField.jsx'
import { t } from '../../../lib/i18n.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { useUI } from '../../../store/useUI.js'
import { bwSheet, bwTooHeavy } from '../../../sheets.jsx'
import {
  BIRTH_YEAR, GOAL_IDS, HEIGHT_CM, SEX_IDS, birthYearMax, cmOfFeet, currentIn, feetOf, goalLabel, goalSub, heightText, movementLabel,
  movementOptions, parseWeight, sexLabel, targetPreview, weightText,
} from './goal-data.js'
import { announceSaved, failureText } from './goal-feedback.js'
import { useGoal } from './use-goal.js'
import './goal.css'

// My goal's small drawers (boards Me3GoalSheet, Me3Target, Me3BodySheet, Me3Movement). Each is a
// `BottomSheet` `variant: 'ds'` that saves through useGoal()'s actions and closes to the page; the
// page then offers Undo for 8 s in a toast (Me3Saved) and the change waits in Recent changes. A
// refused write keeps the drawer open with the error and the typed values. Opened from inside a
// drawer (Log weight from Body details) they are sub-panels by themselves.

const say = message => useUI.getState().toast(message)

// Runs a write, closes on success and toasts what changed; on failure keeps the drawer and says why.
function useSave(close) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const save = async (run, message) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await run()
    setBusy(false)
    if (!res.ok) { setError(failureText(res.error)); return }
    close()
    if (res.changed) announceSaved(message(res), res)
  }
  return { busy, error, save }
}

const ErrorLine = ({ text }) => (text ? <p className="mg-error" role="alert">{text}</p> : null)
const Soon = () => <p className="mg-foot">{t('Changing this arrives soon')}</p>

/* ============================ Goal (Me3GoalSheet) ============================ */
function GoalDrawer({ close }) {
  const g = useGoal()
  const { busy, error, save } = useSave(close)
  const pick = id => id === g.goal ? close() : save(
    () => g.actions.setGoal(id),
    res => (res.recomputed === false
      ? t('Goal changed to {0}. Your Daily targets were left as they were.', goalLabel(id))
      : t('Goal changed to {0}', goalLabel(id))),
  )
  return (
    <BottomSheet title={t('Goal')}>
      <div role="radiogroup" aria-label={t('Goal')} aria-busy={busy}>
        {GOAL_IDS.map(id => (
          <RadioRow key={id} title={goalLabel(id)} sub={goalSub(id)} selected={g.goal === id} onClick={() => pick(id)} />
        ))}
      </div>
      <ErrorLine text={error} />
      <p className="mg-foot">{t('Your Daily targets follow the goal you pick. You can still set them by hand.')}</p>
    </BottomSheet>
  )
}
export const goalPickSheet = () => useUI.getState().openSheet(close => <GoalDrawer close={close} />, { variant: 'ds' })

/* ============================ Target weight (Me3Target) ============================ */
// A drawer that starts from the saved values waits for them (opened with the settings still on
// their way, it would start empty and stay empty).
function Pending({ title }) {
  return <BottomSheet title={title}><i className="g-skel mg-sk" /></BottomSheet>
}

// Only a drawer with no settings yet waits. A save re-reads them (status 'loading' with the data still
// there), and the form must stay mounted through that, with Save disabled by `busy`, or the typed
// values are lost (the pattern of TargetsDrawer).
function useWaiting(g) {
  const hasData = useNutrition(s => !!s.settings.data)
  return g.status === 'loading' && !hasData
}

function TargetDrawer({ close }) {
  const g = useGoal()
  return useWaiting(g) ? <Pending title={t('Target weight')} /> : <TargetForm g={g} close={close} />
}

function TargetForm({ g, close }) {
  const { profile, targets } = g
  const unit = profile.unit
  const start = profile.target ?? currentIn(profile.current, unit)
  const [text, setText] = useState(start != null ? weightText(start) : '')
  const { busy, error, save } = useSave(close)
  const preview = targetPreview({ text, profile, targets })

  const submit = () => {
    const n = parseWeight(text)
    if (!n || n <= 0) { say(t('Enter a valid weight')); return }
    if (bwTooHeavy(n, unit)) return
    save(() => g.actions.setTargetWeight(n), () => t('Target weight changed to {0}', weightText(n) + ' ' + unit))
  }
  const remove = () => save(() => g.actions.setTargetWeight(null), () => t('Target weight removed'))

  return (
    <BottomSheet title={t('Target weight')}
      footer={<>
        <Button block busy={busy} onClick={submit}>{t('Save target weight')}</Button>
        {profile.target != null && <Button block variant="ghost" onClick={remove}>{t('Remove target weight')}</Button>}
      </>}>
      <TextField label={t('Target weight')} unit={unit} value={text} inputMode="decimal" hint={preview || undefined} onChange={setText}
        inputProps={{ enterKeyHint: 'done', onKeyDown: e => { if (e.key === 'Enter') submit() } }} />
      <ErrorLine text={error} />
    </BottomSheet>
  )
}
/** Board Me3Target: set or remove the target weight. Works without NutriTrace (it is `S.targetW`). */
export const targetWeightSheet = () => useUI.getState().openSheet(close => <TargetDrawer close={close} />, { variant: 'ds' })

/* ============================ Body details (Me3BodySheet) ============================ */
// Read-only while the hub refuses the profile keys (PROFILE_WRITES_LIVE in lib/me/goal-writes.js).
function BodyDrawer({ close }) {
  const g = useGoal()
  return useWaiting(g) ? <Pending title={t('Body details')} /> : <BodyForm g={g} close={close} />
}

function BodyForm({ g, close }) {
  const { profile: p } = g
  const lb = p.unit === 'lb'
  const feet = p.heightCm ? feetOf(p.heightCm) : null
  const [cm, setCm] = useState(p.heightCm ? String(p.heightCm) : '')
  const [ft, setFt] = useState(feet ? String(feet.ft) : '')
  const [inch, setInch] = useState(feet ? String(feet.inch) : '')
  const [year, setYear] = useState(p.birthYear ? String(p.birthYear) : '')
  const [sex, setSex] = useState(p.sex)
  const [invalid, setInvalid] = useState(null)
  const { busy, error, save } = useSave(close)

  if (!g.profileLive) {
    return (
      <BottomSheet title={t('Body details')}>
        <div className="g-glist g-glist-light">
          <GlassValueRow static title={t('Height')} value={heightText(p.heightCm, p.unit) ?? t('Add')} />
          <GlassValueRow static title={t('Birth year')} value={p.birthYear ? String(p.birthYear) : t('Add')} />
          <GlassValueRow static title={t('Sex')} value={sexLabel(p.sex)} />
        </div>
        <Soon />
      </BottomSheet>
    )
  }

  const submit = () => {
    const heightCm = lb ? (ft.trim() || inch.trim() ? cmOfFeet(ft, inch) : undefined) : (cm.trim() ? Math.round(Number(cm.replace(',', '.'))) : undefined)
    const birthYear = year.trim() ? Number(year) : undefined
    if (heightCm !== undefined && !(heightCm >= HEIGHT_CM.min && heightCm <= HEIGHT_CM.max)) {
      setInvalid(t('Height must be between {0} and {1} cm.', HEIGHT_CM.min, HEIGHT_CM.max))
      return
    }
    if (birthYear !== undefined && !(Number.isInteger(birthYear) && birthYear >= BIRTH_YEAR.min && birthYear <= birthYearMax())) {
      setInvalid(t('Birth year must be between {0} and {1}.', BIRTH_YEAR.min, birthYearMax()))
      return
    }
    setInvalid(null)
    save(() => g.actions.setBodyDetails({ heightCm, birthYear, sex }), () => t('Body details saved'))
  }

  return (
    <BottomSheet title={t('Body details')} footer={<Button block busy={busy} onClick={submit}>{t('Save body details')}</Button>}>
      <div className="mg-fields">
        {lb
          ? <div className="mg-pair">
            <TextField label={t('Feet')} unit={t('ft')} value={ft} inputMode="numeric" onChange={setFt} />
            <TextField label={t('Inches')} unit={t('in')} value={inch} inputMode="numeric" onChange={setInch} />
          </div>
          : <TextField label={t('Height')} unit={t('cm')} value={cm} inputMode="numeric" onChange={setCm} />}
        <TextField label={t('Birth year')} value={year} inputMode="numeric" onChange={setYear} inputProps={{ maxLength: 4 }} />
        <div className="mg-sex">
          <span className="mg-label">{t('Sex')}</span>
          <SegmentedControl label={t('Sex')} value={sex} onChange={setSex} options={SEX_IDS.map(id => ({ value: id, label: sexLabel(id) }))} />
        </div>
      </div>
      <ErrorLine text={invalid || error} />
      <p className="mg-foot">{t('Only used to estimate your burn. Never shown to Friends.')}</p>
      {!g.current && (
        <div className="mg-need">
          <p className="mg-foot">{t('Your burn estimate needs a weigh-in.')}</p>
          <Button variant="secondary" onClick={() => bwSheet()}>{t('Log weight')}</Button>
        </div>
      )}
    </BottomSheet>
  )
}
export const bodyDetailsSheet = () => useUI.getState().openSheet(close => <BodyDrawer close={close} />, { variant: 'ds' })

/* ============================ Daily movement (Me3Movement) ============================ */
function MovementDrawer({ close }) {
  const g = useGoal()
  const { busy, error, save } = useSave(close)
  const current = g.profile.movement

  if (!g.profileLive) {
    return (
      <BottomSheet title={t('Daily movement')}>
        <div className="g-glist g-glist-light">
          <GlassValueRow static title={t('Daily movement')} value={movementLabel(current) ?? t('Add')} />
        </div>
        <Soon />
      </BottomSheet>
    )
  }

  const pick = id => save(() => g.actions.setMovement(id), () => t('Daily movement changed'))
  return (
    <BottomSheet title={t('Daily movement')}>
      <div role="radiogroup" aria-label={t('Daily movement')} aria-busy={busy}>
        {movementOptions().map(o => <RadioRow key={o.id} title={o.title} sub={o.sub} selected={current === o.id} onClick={() => pick(o.id)} />)}
      </div>
      <ErrorLine text={error} />
      <p className="mg-foot">{t('Workouts and activities are counted separately, in Burned.')}</p>
    </BottomSheet>
  )
}
export const movementSheet = () => useUI.getState().openSheet(close => <MovementDrawer close={close} />, { variant: 'ds' })
