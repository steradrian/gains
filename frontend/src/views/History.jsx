import { useStore } from '../store/useStore.js'
import { Page } from '../components/layout.jsx'
import { t, tn } from '../lib/i18n.js'
import { WorkoutRow, DayNoteRow, workoutDetailSheet, logPastWorkoutSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import { EmptyState } from '../components/blocks.jsx'
import { dayNoteOf } from '../lib/day-notes.js'
import { navToDay } from '../lib/day-route.js'
import { todayISO } from '../lib/format.js'
import { workoutDay } from '../lib/history.js'

// Newest first: every workout, and in between them the days off you left a note on (#261). A
// note on a day that has a workout too stays in the day sheet; the workout speaks for that day.
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes]
  // Stable, so workouts keep the order they are stored in (by day, then start) within a day.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}

// A past workout opens its day (PR07 D1, under Train), where the workout is listed with the rest
// of that day; one from today opens its detail, since the Day page is never today.
export function openWorkout(w, today = todayISO()) {
  const day = workoutDay(w)
  if (day && day < today) navToDay(day, 'train')
  else workoutDetailSheet(w)
}

export default function History() {
  const S = useStore(s => s.S)
  const rows = historyRows(S)
  return <Page title={t('History')} sub={tn('{0} workout', '{0} workouts', S.workouts.length)}>
    <Button icon="plus" onClick={logPastWorkoutSheet} style={{ marginBottom: 12 }}>{t('Log a past workout')}</Button>
    {rows.length ? <div className="list">{rows.map(r => r.w
      ? <WorkoutRow key={r.w.id} w={r.w} onClick={() => openWorkout(r.w)} />
      : <DayNoteRow key={'note-' + r.d} iso={r.d} note={r.note} />)}</div>
      : <EmptyState illustration="calendar" title={t('No workouts yet')} />}
  </Page>
}
