import { useMemo, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { t, tn } from '../../../lib/i18n.js'
import { fmtDate } from '../../../lib/format.js'
import { DAY_NOTE_ICON, DAY_NOTE_LABEL } from '../../../lib/day-notes.js'
import { workoutLabel } from '../../../lib/training-day.js'
import Icon from '../../../components/Icon.jsx'
import MonthGrid from '../../../ds/MonthGrid.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StagePage from '../../../ds/StagePage.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import { dayNoteSheet, logPastWorkoutSheet, startChooserSheet } from '../../../sheets.jsx'
import { useTodayDate } from '../../today/use-today.js'
import { tapDay, tapWorkout } from '../tap-day.js'
import { activitiesOf, historyRows, historySub, historyWeeks, monthOf, workoutLine, workoutThumbs } from './use-history.js'

function WorkoutHistoryRow({ S, w, today }) {
  return (
    <button type="button" className="g-glist-row g-hist-row" onClick={() => tapWorkout(w, today)}>
      <span className="g-tr-stack g-hist-stack" aria-hidden="true">
        {workoutThumbs(S, w).map((src, i) => (
          <span key={i}>{src ? <img src={src} alt="" width="40" height="40" loading="lazy" /> : <i><Icon name="dumbbell" className="g-icon" /></i>}</span>
        ))}
      </span>
      <span className="g-glist-body"><b>{workoutLabel(w)}</b><span>{workoutLine(w, S.unit)}</span></span>
      <Icon name="chevronRight" className="g-icon g-glist-chev" />
    </button>
  )
}

// A day off with a note on it (#261) keeps its place between the workouts, as a glass row.
function NoteHistoryRow({ iso, note }) {
  return (
    <button type="button" className="g-glist-row g-hist-row" onClick={() => dayNoteSheet(iso)}>
      <span className="g-glist-ic" aria-hidden="true"><Icon name={note.tag ? DAY_NOTE_ICON[note.tag] : 'note'} className="g-icon" /></span>
      <span className="g-glist-body"><b>{note.tag ? t(DAY_NOTE_LABEL[note.tag]) : t('Day note')}</b><span>{[fmtDate(iso, true), note.text].filter(Boolean).join(' · ')}</span></span>
      <Icon name="chevronRight" className="g-icon g-glist-chev" />
    </button>
  )
}

/**
 * T8.0 History (/train/history): the count since the first workout, the month with its trained
 * days (any day opens: a workout, or the day to plan a session), then the weeks, newest first,
 * each workout and day note a row. Log a past workout is the bar's action. T8.2 when nothing is
 * logged. The All / Workouts / Activities switch waits for an activity source (activitiesOf).
 */
export default function HistoryScreen() {
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [kind, setKind] = useState('all')
  const activities = activitiesOf(S)
  const rows = historyRows(S)
  const weeks = useMemo(() => historyWeeks(S, today), [S, today])
  const cal = monthOf(S, month.y, month.m, today)
  const turn = n => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }))
  const logPast = { icon: 'plus', label: t('Log a past workout'), onClick: () => logPastWorkoutSheet() }
  return (
    <StagePage largeTitle={t('History')} sub={historySub(S, today)} parent="/train" actions={[logPast]}>
      {!rows.length ? (
        <div className="g-hist-pad">
          <StageEmpty icon="calendar" title={t('No workouts yet')} body={t('Workouts you log show up here, newest first.')}
            actions={[
              { label: t('Start a workout'), icon: 'play', solid: true, onClick: () => startChooserSheet() },
              { label: t('Log a past workout'), onClick: () => logPastWorkoutSheet() },
            ]} />
        </div>
      ) : (
        <>
          {activities.length > 0 && (
            <div className="g-hist-pad">
              <StageSegmented label={t('Show')} value={kind} onChange={setKind}
                options={[{ value: 'all', label: t('All') }, { value: 'workouts', label: t('Workouts') }, { value: 'activities', label: t('Activities') }]} />
            </div>
          )}
          <div className="g-hist-pad">
            <MonthGrid title={cal.title} weekdays={cal.weekdays} offset={cal.offset} days={cal.days} today={cal.today}
              onDay={iso => tapDay(S, iso, today)} onPrev={() => turn(-1)} onNext={() => turn(1)}
              prevLabel={t('Previous month')} nextLabel={t('Next month')} />
            <p className="g-hist-hint">{t('Tap a trained day for details · tap any other day to plan a session')}</p>
          </div>
          {kind !== 'activities' && weeks.map(week => (
            <section key={week.key} className="g-hist-week">
              <StageSection title={week.title} action={week.workouts ? tn('{0} workout', '{0} workouts', week.workouts) : undefined} />
              <div className="g-glist g-glass g-hist-list">
                {week.rows.map(r => (r.w
                  ? <WorkoutHistoryRow key={r.w.id ?? r.w.d + '|' + r.w.start} S={S} w={r.w} today={today} />
                  : <NoteHistoryRow key={'note-' + r.d} iso={r.d} note={r.note} />))}
              </div>
            </section>
          ))}
        </>
      )}
    </StagePage>
  )
}
