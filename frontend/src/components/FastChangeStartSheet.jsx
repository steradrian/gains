import { useState } from 'react'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import TextField from '../ds/TextField.jsx'
import { t } from '../lib/i18n.js'
import { EDIT_BACKDATE_MS, endsAt, startProblem } from '../lib/nutrition/fasting.js'
import { useNow } from '../lib/nutrition/use-fasting.js'
import { useUI } from '../store/useUI.js'
import { dayTimeText, localInputValue, timeText } from '../views/fasting/fast-format.js'

// Change start (board Ea6Edit), the light drawer over the running fast: the person forgot to start
// it on time, so the start moves back (never ahead, at most 7 days). The end moves with it. An
// invalid day or time disables the button and says why. `onSave(startAtIso)` resolves to null
// once saved, else the sentence for why not. `now` is for the gallery's frozen clock.
export default function FastChangeStartSheet({ fast, now: fixedNow, hour12, onSave }) {
  const ticking = useNow(fixedNow === undefined, 30000)
  const now = fixedNow ?? ticking
  const [init] = useState(() => localInputValue(Date.parse(fast.start_at)))
  const [day, setDay] = useState(init.slice(0, 10))
  const [time, setTime] = useState(init.slice(11, 16))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  const startMs = day && time ? Date.parse(`${day}T${time}`) : NaN
  const problem = startProblem(startMs, now, EDIT_BACKDATE_MS)
  const reason = problem === 'invalid' ? t('Enter a date and time.')
    : problem === 'future' ? t('The start cannot be in the future.')
    : problem === 'old' ? t('The start can be at most 7 days back.')
    : null

  const save = async () => {
    setBusy(true)
    setFailed(null)
    const error = await onSave(new Date(startMs).toISOString())
    if (error) { setFailed(error); setBusy(false) }
  }

  return (
    <BottomSheet title={t('Change start')} type="auto"
      footer={<Button block busy={busy} disabled={!!reason} onClick={save}>{reason ? t('Move start') : t('Move start to {0}', timeText(startMs, hour12))}</Button>}>
      <div className="g-fast-sheet">
        <p className="g-fast-lead">{t('Forgot to start it on time? Move the start back. Not in the future, at most 7 days back.')}</p>
        <div className="g-fast-pair">
          <TextField label={t('Day')} value={day} onChange={setDay}
            inputProps={{ type: 'date', min: localInputValue(now - EDIT_BACKDATE_MS).slice(0, 10), max: localInputValue(now).slice(0, 10) }} />
          <TextField label={t('Time')} value={time} onChange={setTime} inputProps={{ type: 'time' }} />
        </div>
        {!reason && <p className="g-fast-lead">{t('Now ends {0}', dayTimeText(endsAt(startMs, fast.goal_hours), hour12))}</p>}
        {(reason || failed) && <p className="g-bs-note g-fast-why" role="alert">{reason || failed}</p>}
      </div>
    </BottomSheet>
  )
}

export function fastChangeStartSheet(props) {
  return useUI.getState().openSheet(() => <FastChangeStartSheet {...props} />, { variant: 'ds' })
}
