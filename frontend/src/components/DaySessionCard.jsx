import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { effectiveRoutines, workoutDay } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { WorkoutRow, workoutDetailSheet, logPastWorkoutSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Training on a day other than today, where the Today card stands on Home: the workouts logged
// that day, else what is planned for it, else a rest day (and, in the past, a way to log one).
export default function DaySessionCard({ date }) {
  const S = useStore(s => s.S)
  const done = S.workouts.filter(w => workoutDay(w) === date)
  const planned = effectiveRoutines(S, date)
  const past = date < todayISO()
  const names = planned.map(r => r.name).join(' + ')
  return <div className="card day-session">
    <div className="lbl2">{t('Training')}</div>
    {done.length > 0
      ? <div className="list">{done.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="row between day-session-row">
          <div className="row nt-lead">
            <span className="lrow-i tint-quiet"><Icon name={planned.length ? 'calendar' : 'moon'} /></span>
            <div className="ttl">{planned.length ? (past ? t('Planned, not logged: {0}', names) : names) : t('Rest day')}</div>
          </div>
          {past && <Button size="sm" variant="tinted" icon="plus" onClick={() => logPastWorkoutSheet({ iso: date })}>{t('Log workout')}</Button>}
        </div>}
  </div>
}
