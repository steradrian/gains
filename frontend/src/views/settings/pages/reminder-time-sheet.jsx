import { useRef, useState } from 'react'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { WheelColumn } from '../../../components/DurationWheel.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import { joinTime, splitTime } from './reminder-state.js'

// The drawer of the workout-day reminder's time (board St1ReminderTime): hour and minute wheels,
// the planned weekdays lit, and Save. Nothing is written until Save; closing any other way leaves
// the time as it was.

const pad2 = n => String(n).padStart(2, '0')
const WEEK = [1, 2, 3, 4, 5, 6, 0]

const weekdayLetter = (wd, lang) => {
  try { return new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + wd)) } catch { return String(wd) }
}

function ReminderTimeSheet({ time, days, lang, onSave, close }) {
  const [h0, m0] = splitTime(time)
  const [h, setH] = useState(h0)
  const [m, setM] = useState(m0)
  const hRow = useRef(null)
  const mRow = useRef(null)
  // A Save tapped straight after a flick must not keep the value from before it.
  const save = () => {
    const next = joinTime(hRow.current ? hRow.current() : h, mRow.current ? mRow.current() : m)
    close()
    onSave(next)
  }
  return (
    <BottomSheet title={t('Workout days')} type="auto" footer={<Button block haptic onClick={save}>{t('Save reminder')}</Button>}>
      <div className="dw g-rt-wheel" data-nodrag="" dir="ltr">
        <span className="dw-band" aria-hidden="true" />
        <WheelColumn count={24} index={h} onPick={setH} label={t('Hours')} format={pad2} step={3} rowRef={hRow} valueText={joinTime(h, m)} />
        <WheelColumn count={60} index={m} onPick={setM} label={t('Minutes')} format={pad2} step={5} rowRef={mRow} valueText={joinTime(h, m)} />
      </div>
      <ul className="g-rt-days" aria-label={t('Planned days')}>
        {WEEK.map(wd => (
          <li key={wd} className={days.has(wd) ? 'on' : undefined}>{weekdayLetter(wd, lang)}</li>
        ))}
      </ul>
      <p className="g-bs-note">{t('Lit days follow your Plan. Change the Plan and the reminder follows.')}</p>
    </BottomSheet>
  )
}

/** Opens the drawer; `onSave("HH:MM")` runs on Save. `days` is the Set of planned weekdays (0 = Sunday). */
export const reminderTimeSheet = ({ time, days, lang, onSave }) =>
  useUI.getState().openSheet(close => <ReminderTimeSheet time={time} days={days} lang={lang} onSave={onSave} close={close} />, { variant: 'ds' })

export { ReminderTimeSheet }
