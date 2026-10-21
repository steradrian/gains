import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { REST_MAX, clampDuration, fmtRest, durationText } from '../../../lib/duration.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import ChipGroup from '../../../ds/ChipGroup.jsx'

const STEP = 15
const PRESETS = [60, 90, 120, 180]
const presetLabel = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

// Workout screen → Rest timer (board St1RestTimer). Live: every tap writes S.restSec at once, as
// the wheel did, so there is nothing to save; Done only closes. 0:00 is "Off". A routine's or an
// exercise's own rest wins over this one.
export function RestTimerSheet({ close }) {
  const sec = useStore(s => s.S.restSec)
  const update = useStore(s => s.update)
  const set = v => update(s => { s.restSec = clampDuration(v, 0, REST_MAX) })
  return (
    <BottomSheet title={t('Rest timer')} chip={t('Every exercise')} chipIcon="timer">
      <div className="set-rest">
        <div className="set-rest-dial">
          <Button variant="secondary" aria-label={t('15 seconds less')} disabled={sec <= 0} onClick={() => set(sec - STEP)}>{t('−15 s')}</Button>
          <span className="set-rest-time" aria-live="polite" aria-label={durationText(sec, { off: t('Off') })}>{fmtRest(sec)}</span>
          <Button variant="secondary" aria-label={t('15 seconds more')} disabled={sec >= REST_MAX} onClick={() => set(sec + STEP)}>{t('+15 s')}</Button>
        </div>
        <ChipGroup label={t('Presets')} value={PRESETS.includes(sec) ? sec : null} options={PRESETS.map(p => ({ value: p, label: presetLabel(p) }))} onChange={set} />
        <p className="set-rest-note">{t('Each exercise can have its own rest in the routine editor; that one wins.')}</p>
        <Button variant="primary" block onClick={close}>{t('Done')}</Button>
      </div>
    </BottomSheet>
  )
}

export const openRestTimerSheet = () => useUI.getState().openSheet(close => <RestTimerSheet close={close} />, { variant: 'ds' })
