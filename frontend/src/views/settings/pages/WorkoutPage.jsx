import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { effortOf } from '../../../lib/history.js'
import { MOBILE } from '../../../lib/mobile.js'
import { unlock, playOnSilentSupported, appleTouchDevice } from '../../../lib/sound.js'
import { restSoundOf } from '../../../lib/rest-sounds.js'
import { REST_PAUSE_MIN, REST_PAUSE_MAX, fmtRest, fmtDuration } from '../../../lib/duration.js'
import { durationSheet } from '../../../components/DurationWheel.jsx'
import Icon from '../../../components/Icon.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { settingsPath } from '../paths.js'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { openEffortHelpSheet } from './effort-help-sheet.jsx'
import { openRestSoundSheet, REST_SOUND_LABEL } from './rest-sound-sheet.jsx'
import { openRestTimerSheet } from './rest-timer-sheet.jsx'

const EFFORT_LABEL = { none: 'Off', rir: 'RIR', rpe: 'RPE' }

// Workout screen (board St1Workout, A1.14): how the workout looks, what a rest does when it ends,
// and what stays on during one. The end-of-rest rows were the Timer alerts page; /me/alerts lands
// here (lib/tab-route.js PROFILE_RENAMED). The Rest timer opens its drawer (A1.15), the sound
// list its own; Fine-tuning is the next page down.
export default function WorkoutPage() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { wakeOK, canVibrate, android } = useSettingsCtx()
  const effort = effortOf(S)
  const iPhone = appleTouchDevice()
  const line = [
    t(EFFORT_LABEL[effort] || 'Off'),
    S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer'),
  ].join(' · ')
  const set = (key, v) => update(s => { s[key] = v })

  return (
    <SettingsPage title={t('Workout screen')} line={line}>
      <div className="set-body">
        <StageSection variant="label" title={t('On each exercise')} />
        <div className="g-glist g-glass">
          <SettingRow icon="gauge" title={t('Effort per set')} sub={t('RIR: reps left in the tank. RPE: 1 to 10')}
            trailing={<button type="button" className="set-help" aria-label={t('What are RIR and RPE?')} onClick={openEffortHelpSheet}><Icon name="info" className="g-icon" /></button>}
            below={<StageSegmented label={t('Effort per set')} value={effort}
              options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
              onChange={v => update(s => { s.effort = v; delete s.showRir })} />} />
          <SettingRow icon="history" title={t('Shown under each exercise')} sub={t('What you see as the reference')}
            below={<StageSegmented label={t('Shown under each exercise')} value={S.logRef === 'best' ? 'best' : 'last'}
              options={[{ value: 'last', label: t('Last time') }, { value: 'best', label: t('Best set') }]} onChange={v => set('logRef', v)} />} />
          <SettingRow icon="image" title={t('Exercise animations')} sub={t('The catalogue clip on each card')}
            below={<StageSegmented label={t('Exercise animations')} value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
              options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]} onChange={v => set('gifSize', v)} />} />
        </div>

        <StageSection variant="label" title={t('Rest')} />
        <div className="g-glist g-glass">
          <SettingRow icon="timer" title={t('Rest timer')} sub={t('Default between sets; a routine can set its own')} value={fmtRest(S.restSec)} onClick={openRestTimerSheet} />
          {/* A planned exercise's own "Rest (s)" overrides it, as the main rest timer is the fallback
              for an exercise without one. A burst's rest is never 0 (lib/history.js keeps it at 5 s). */}
          <SettingRow icon="bolt" title={t('Rest-pause rest')} sub={t('Between bursts of a rest-pause set')} value={fmtDuration(S.restPauseSec || 15)}
            onClick={() => durationSheet({
              title: t('Rest-pause rest'), value: S.restPauseSec || 15, min: REST_PAUSE_MIN, max: REST_PAUSE_MAX,
              footer: t('The short break between the bursts of a rest-pause set.'),
              onDone: v => set('restPauseSec', v),
            })} />
        </div>

        <StageSection variant="label" title={t('When a rest ends')} />
        <div className="g-glist g-glass">
          <SettingRow icon="speaker" title={t('Play a sound')}
            trailing={<StageSwitch label={t('Play a sound')} checked={!!S.sound} onChange={v => { if (v) unlock(true); set('sound', v) }} />} />
          {S.sound && <SettingRow icon="bell" title={t('Sound')} sub={t('Tap to hear it')} value={t(REST_SOUND_LABEL[restSoundOf(S)])} onClick={openRestSoundSheet} />}
          {/* iOS only (WebKit's audio-session API): with it off the ring/silent switch mutes the timer. */}
          {S.sound && playOnSilentSupported() && (
            <SettingRow icon="speaker" title={t('Play even on silent')}
              sub={<>{t('Music playing on this phone stops during a workout and does not resume by itself.')}<br />{t('iPhone only')}</>}
              trailing={<StageSwitch label={t('Play even on silent')} checked={!!S.soundOnSilent} onChange={v => set('soundOnSilent', v)} />} />
          )}
          {/* iOS has no navigator.vibrate: the row stays, out of reach, and says why. */}
          {canVibrate
            ? <SettingRow icon="vibrate" title={t('Vibrate')} trailing={<StageSwitch label={t('Vibrate')} checked={S.vibrate !== false} onChange={v => set('vibrate', v)} />} />
            : <SettingRow icon="vibrate" title={t('Vibrate')} sub={iPhone ? t('Not on iPhone') : t('Not supported in this browser.')} dim />}
          {MOBILE && android && canVibrate && S.vibrate !== false && (
            <SettingRow icon="vibrate" title={t('Vibrate on silent too')} sub={t('The end of a rest or a hold buzzes like an alarm, even in silent mode.')}
              trailing={<StageSwitch label={t('Vibrate on silent too')} checked={!!S.vibrateOnSilent} onChange={v => set('vibrateOnSilent', v)} />} />
          )}
          <SettingRow icon="sun" title={t('Flash the screen')} sub={t('For loud gyms')}
            trailing={<StageSwitch label={t('Flash the screen')} checked={!!S.timerFlash} onChange={v => set('timerFlash', v)} />} />
        </div>
        {!canVibrate && iPhone && <StageNote>{t('iPhone doesn’t let Gains vibrate. A sound or a flash does the job.')}</StageNote>}

        <StageSection variant="label" title={t('During a workout')} />
        <div className="g-glist g-glass">
          <SettingRow icon="scale" title={t('Weigh in before workouts')} sub={t('Asks for your body weight when a workout starts. Off starts the session straight away.')}
            trailing={<StageSwitch label={t('Weigh in before workouts')} checked={S.weighIn !== false} onChange={v => set('weighIn', v)} />} />
          {(wakeOK || !MOBILE) && (wakeOK
            ? <SettingRow icon="phoneScreen" title={t('Keep screen awake')} sub={t('While a workout is open')}
              trailing={<StageSwitch label={t('Keep screen awake')} checked={S.keepAwake !== false} onChange={v => set('keepAwake', v)} />} />
            : <SettingRow icon="phoneScreen" title={t('Keep screen awake')} sub={t('Not supported in this browser.')} dim />)}
        </div>

        <div className="g-glist g-glass">
          <SettingRow icon="wrench" title={t('Fine-tuning')} sub={t('Swipe actions')} onClick={() => nav(settingsPath('advanced'))} />
        </div>
      </div>
    </SettingsPage>
  )
}
