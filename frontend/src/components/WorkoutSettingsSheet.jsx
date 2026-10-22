import { useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { effortOf } from '../lib/history.js'
import { unlock } from '../lib/sound.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { MOBILE } from '../lib/mobile.js'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import DetailRow from '../ds/DetailRow.jsx'
import Switch from '../ds/Switch.jsx'
import DurationWheel from './DurationWheel.jsx'
import '../views/workout/map-drawers.css'

// The settings people touch at the gym, without leaving the workout (Workout options > Workout
// settings, board W1.21). Every row writes the same S.* field as Settings > Workout, so a change
// sticks for the next session too. Vibrate, Flash the screen, Swipe actions and Exercise animations
// stay in Settings > Workout; Layout and All settings are not in the workout any more.

/** A duration wheel as a step inside a drawer: a back button at the top, the wheel, Done. `onDone(sec)` runs, then `onBack`. */
export function RestStep({ back, value, off, hint, onDone, onBack }) {
  const [v, setV] = useState(value)
  const read = useRef(null)
  const done = () => { onDone(read.current ? read.current() : v); onBack() }
  return <div className="g-ws-step">
    <Button variant="ghost" size="sm" icon="chevronLeft" onClick={onBack}>{back}</Button>
    <DurationWheel variant="ds" value={v} onChange={setV} max={REST_MAX} off={off} readRef={read} />
    {hint && <p className="g-ws-hint">{hint}</p>}
    <Button block onClick={done}>{t('Done')}</Button>
  </div>
}

/** The six rows and the footer note. `onRest` opens the rest wheel step in the caller's drawer. */
export function WorkoutSettingsBody({ onRest }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const wakeOK = wakeLockSupported()
  const effort = effortOf(S)
  // Off is `none`; the choice before it is kept, so On brings back RIR or RPE, RIR when there was none.
  const setEffort = on => update(s => {
    const now = effortOf(s)
    if (on) s.effort = s.effortLast === 'rpe' ? 'rpe' : 'rir'
    else { if (now !== 'none') s.effortLast = now; s.effort = 'none' }
    delete s.showRir
  })
  return <div className="g-ws-body">
    <Switch label={t('Next exercise on its own')} description={t('After the last set, with Back')}
      checked={S.autoNext !== false} onChange={v => update(s => { s.autoNext = v })} />
    <DetailRow icon="timer" title={t('Rest timer')} sub={t('After every set; a superset rests after the round')}
      value={fmtRest(S.restSec)} onClick={onRest} />
    {/* A tap: unlock the audio now so a rest ending before the next tick can sound (iOS, #152). */}
    <Switch label={t('Sound')} description={t('Chime when rest or a hold ends')}
      checked={!!S.sound} onChange={v => { if (v) unlock(true); update(s => { s.sound = v }) }} />
    <Switch label={t('Plate loading')} description={t('Shows the plates under barbell sets')}
      checked={S.showPlates !== false} onChange={v => update(s => { s.showPlates = v })} />
    <Switch label={t('Effort per set')} description={effort === 'none' ? t('Asks reps in the tank after each set') : effort === 'rpe' ? t('RPE') : t('RIR')}
      checked={effort !== 'none'} onChange={setEffort} />
    {(wakeOK || !MOBILE) && <Switch label={t('Keep screen on')}
      description={wakeOK ? t('While the workout runs') : t('Not supported in this browser.')}
      checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK} onChange={v => update(s => { s.keepAwake = v })} />}
    <p className="g-ws-hint">{t('Warm-ups and cool-downs come from the routine. Skip either one in the map.')}</p>
  </div>
}

/** The default rest on the wheel (0:00 turns the timer off), as a step. */
export function RestTimerStep({ back, onBack }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  return <RestStep back={back} value={S.restSec} off={t('Off')} hint={t('Scroll to 0:00 to turn the rest timer off.')}
    onBack={onBack} onDone={v => update(s => { s.restSec = v })} />
}

/** Standalone Workout settings (the old screen's header menu): the rows, with the rest wheel as a step. */
export function WorkoutSettings() {
  const [step, setStep] = useState('rows')
  return <BottomSheet type="auto" title={t('Workout settings')}>
    {step === 'rest'
      ? <RestTimerStep back={t('Workout settings')} onBack={() => setStep('rows')} />
      : <WorkoutSettingsBody onRest={() => setStep('rest')} />}
  </BottomSheet>
}

/** Opens the in-workout settings sheet. */
export function workoutSettingsSheet() {
  return useUI.getState().openSheet(() => <WorkoutSettings />, { variant: 'ds' })
}
