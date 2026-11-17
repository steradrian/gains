import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { unlock, chime } from '../../../lib/sound.js'
import { REST_SOUND_IDS, restSoundOf } from '../../../lib/rest-sounds.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import RadioRow from '../../../ds/RadioRow.jsx'

// Workout screen → Sound (#306): every end-of-rest sound, each played as it is picked so you hear
// it before the next rest does. The drawer stays open for the next one; the × closes it. Stored as
// S.restSound, with S.classicChime kept for an app from before (lib/rest-sounds.js restSoundOf).
export const REST_SOUND_LABEL = { chime: 'Chime (louder)', classic: 'Classic beeps', bell: 'Bell', beep: 'Beep-beep', whistle: 'Whistle', soft: 'Soft' }
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

export function RestSoundSheet() {
  const S = useStore(s => s.S)
  const cur = restSoundOf(S)
  return (
    <BottomSheet title={t('Sound')}>
      <p className="set-rest-note">{t('Tap one to hear it.')}</p>
      <div role="radiogroup" aria-label={t('Sound')}>
        {REST_SOUND_IDS.map(id => (
          <RadioRow key={id} title={t(REST_SOUND_LABEL[id])} sub={REST_SOUND_HINT[id] ? t(REST_SOUND_HINT[id]) : undefined}
            selected={id === cur} tabIndex={id === cur ? 0 : -1} onClick={() => pickRestSound(id)} />
        ))}
      </div>
    </BottomSheet>
  )
}

export const openRestSoundSheet = () => useUI.getState().openSheet(() => <RestSoundSheet />, { variant: 'ds' })
