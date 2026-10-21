import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { unlock, chime, playOnSilentSupported, appleTouchDevice } from '../../../lib/sound.js'
import { REST_SOUND_IDS, restSoundOf } from '../../../lib/rest-sounds.js'
import { MOBILE } from '../../../lib/mobile.js'
import { SheetHeader, SheetActions } from '../../../components/sheet-layout.jsx'
import { Section, Row, Switch, Button } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

// Settings → Sound (#306): every end-of-rest sound, each played as it is picked so you hear it
// before the next rest does. The sheet stays open for the next one; Done closes it. Stored as
// S.restSound, with S.classicChime kept for an app from before (lib/rest-sounds.js restSoundOf).
const REST_SOUND_LABEL = { chime: 'Chime (louder)', classic: 'Classic beeps', bell: 'Bell', beep: 'Beep-beep', whistle: 'Whistle', soft: 'Soft' }
const REST_SOUND_HINT = {
  classic: 'The quieter three-beep sound from before 1.3.9, instead of the louder chime.',
  bell: 'Ding-dong. Rest is over, class is in.',
  beep: 'Your sports watch, calling you back.',
  whistle: 'Coach wants you back on the bar.',
  soft: 'Gentle, for headphones or a quiet room.',
}
export function pickRestSound(id) {
  unlock(true)
  useStore.getState().update(s => { s.restSound = id; s.classicChime = id === 'classic' })
  chime(true, id)
}
export function RestSoundSheet({ close }) {
  const S = useStore(s => s.S)
  const cur = restSoundOf(S)
  return <>
    <SheetHeader title={t('Sound')} />
    <div className="muted small mb-6">{t('Tap one to hear it.')}</div>
    <Section>
      {REST_SOUND_IDS.map(id => <Row key={id} icon={id === cur ? 'speaker' : 'play'} iconTint="var(--pink)" title={t(REST_SOUND_LABEL[id])}
        subtitle={REST_SOUND_HINT[id] ? t(REST_SOUND_HINT[id]) : null} accessory={id === cur ? 'check' : 'none'}
        onClick={() => pickRestSound(id)} />)}
    </Section>
    <SheetActions>
      <Button variant="primary" onClick={close}>{t('Done')}</Button>
    </SheetActions>
  </>
}
const restSoundSheet = () => useUI.getState().openSheet(close => <RestSoundSheet close={close} />)

export default function AlertsPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { android, canVibrate } = useSettingsCtx()
  const iPhone = appleTouchDevice()
  return <>
    <Section title={t('When a rest ends')}>
      <Row icon="speaker" iconTint="var(--pink)" title={t('Play a sound')}>
        {/* Turning the sound on is a tap: unlock the audio context now so a timer that ends
            before the next set check can already sound (iOS, #152). */}
        <Switch checked={!!S.sound} onChange={v => { if (v) unlock(true); update(s => { s.sound = v }) }} />
      </Row>
      {/* The chime that replaced the original three beeps (Discord: "too quiet under music")
          is not an improvement for everyone: louder is a cost with headphones or in a quiet
          room, and some want a sound that feels like theirs (#306). The chime by default; the
          sheet plays each one as you tap it (restSoundSheet). */}
      {S.sound && <Row icon="speaker" iconTint="var(--pink)" title={t('Sound')} value={t(REST_SOUND_LABEL[restSoundOf(S)])}
        accessory="chevron" onClick={restSoundSheet} />}
      {/* iOS only (WebKit's audio-session API, iOS 17+): with it off the ring/silent switch
          mutes the timer. On, the phone treats the timer like a music player (exclusive, and
          the music app is not told it may resume), so it is a choice, off by default. */}
      {S.sound && playOnSilentSupported() && (
        <Row icon="speaker" iconTint="var(--orange)" title={t('Play even on silent')}
          subtitle={<>{t('Music playing on this phone stops during a workout and does not resume by itself.')}<br />{t('iPhone only')}</>}>
          <Switch checked={!!S.soundOnSilent} onChange={v => update(s => { s.soundOnSilent = v })} />
        </Row>
      )}
    </Section>
    {/* The buzz at the end of a rest or a hold and on a set tick, on its own switch like the
        sound (Discord, asierlama). iOS has no navigator.vibrate: the row stays, greyed out,
        and says so, instead of an iPhone user looking for a setting that is not there. */}
    <Section footer={!canVibrate && iPhone ? t('iPhone doesn’t let Gains vibrate. A sound or a flash does the job.') : null}>
      <Row icon="vibrate" iconTint="var(--indigo)" title={t('Vibrate')} className={canVibrate ? '' : 'dis'}
        subtitle={canVibrate ? null : iPhone ? t('Not on iPhone') : t('Not supported in this browser.')}>
        <Switch checked={canVibrate && S.vibrate !== false} disabled={!canVibrate} onChange={v => update(s => { s.vibrate = v })} />
      </Row>
      {/* Android app only (#375), and only shown there, so it needs no "Android app only" hint: silent mode mutes the ordinary buzz and the notification's,
          so the end of a rest or a hold can buzz as an alarm instead. Opt-in, like the iOS row
          above: an alarm-class buzz is the most insistent thing an app can do on some phones. */}
      {MOBILE && android && canVibrate && S.vibrate !== false && (
        <Row icon="vibrate" iconTint="var(--indigo)" title={t('Vibrate on silent too')}
          subtitle={t('The end of a rest or a hold buzzes like an alarm, even in silent mode.')}>
          <Switch checked={!!S.vibrateOnSilent} onChange={v => update(s => { s.vibrateOnSilent = v })} />
        </Row>
      )}
      <Row icon="sun" iconTint="var(--yellow)" title={t('Flash the screen')}>
        <Switch checked={!!S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} />
      </Row>
    </Section>
  </>
}
