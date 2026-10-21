import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { fmtDate } from '../../lib/format.js'
import { usualDuration } from '../../lib/train-stats.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { submitPastWorkout } from '../../sheets.jsx'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import RadioRow from '../../ds/RadioRow.jsx'
import TextField from '../../ds/TextField.jsx'
import { useTodayDate } from '../today/use-today.js'
import { pastWorkoutChoicesOf } from './day-data.js'

export const DEFAULT_START = '18:00'
const DEFAULT_MINUTES = 60

/**
 * What Add past workout (PR07 D1.6) opens on for the past day `iso`: `{ iso, date, choices, time,
 * durationMin }`. The choices are day-data's (the planned routines first); the length starts at
 * the planned routine's usual one, rounded to 5 minutes, else an hour.
 */
export function pastWorkoutOf(S, iso, today) {
  const choices = pastWorkoutChoicesOf(S, iso, today)
  const planned = choices.find(c => c.planned)?.routineIds[0]
  const usual = planned ? usualDuration(S, planned) : null
  return {
    iso, date: fmtDate(iso, true), choices, time: DEFAULT_START,
    durationMin: usual ? Math.max(5, Math.round(usual / 60000 / 5) * 5) : DEFAULT_MINUTES,
  }
}

// Add past workout (board Sh1PastWorkout), the full light drawer over a Day page: the chip names the
// day, then which workout (the planned one first and picked), when it started and how long it
// took. Start opens that workout on the workout screen for that date (sheets submitPastWorkout,
// which checks the times and asks when the day already has a workout); the drawer closes just
// before it opens. The choices and the starting values are taken once, so they do not move while
// the drawer is open.
export function PastWorkoutSheet({ iso, close }) {
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const [init] = useState(() => pastWorkoutOf(S, iso, today))
  const [key, setKey] = useState(init.choices[0].key)
  const [time, setTime] = useState(init.time)
  const [minutes, setMinutes] = useState(String(init.durationMin))
  const choice = init.choices.find(c => c.key === key) || init.choices[0]
  const start = () => submitPastWorkout({ iso, time, durationMin: Number(minutes), routineIds: choice.routineIds }, { before: close })

  return (
    <BottomSheet type="full" title={t('Add past workout')} chip={init.date} footer={<>
      <Button block onClick={start}>{t('Log {0} for {1}', choice.name, init.date)}</Button>
      <p className="g-bs-note">{t('Opens the workout to fill in sets. It saves to {0}.', init.date)}</p>
    </>}>
      <div className="g-pw-card" role="radiogroup" aria-label={t('Workout')}>
        {init.choices.map(c => (
          <RadioRow key={c.key} title={c.name} sub={c.planned ? t('Planned for this day') + ' · ' + c.sub : c.sub}
            selected={c.key === choice.key} onClick={() => setKey(c.key)} />
        ))}
      </div>
      <div className="g-pw-fields">
        <TextField label={t('Started')} value={init.time} inputProps={{ type: 'time' }} onChange={setTime} />
        <TextField label={t('Took')} unit={t('min')} value={init.durationMin} inputMode="numeric" onChange={setMinutes} />
      </div>
    </BottomSheet>
  )
}

/** Opens Add past workout for the past day `iso` (the Day page, and the + on a Day page). */
export function pastWorkoutSheet(iso) {
  if (useStore.getState().S.active) { useUI.getState().toast(t('Finish the current workout first.')); return }
  useUI.getState().openSheet(close => <PastWorkoutSheet iso={iso} close={close} />, { variant: 'ds' })
}
