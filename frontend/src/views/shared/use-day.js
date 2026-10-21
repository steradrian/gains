import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { firstLogDay, navToDay, navToWeek } from '../../lib/day-route.js'
import { fmtDate } from '../../lib/format.js'
import { skipMissed } from '../../lib/missed-day.js'
import { diaryIndexDays, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { useDiarySelection } from '../../lib/nutrition/selection.js'
import { useDiaryDay } from '../../lib/nutrition/use-diary-day.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { markUndone, undoMarks } from '../../lib/sync-merge.js'
import { usualDuration } from '../../lib/train-stats.js'
import { bwSheet, submitPastWorkout, workoutDetailSheet } from '../../sheets.jsx'
import { foodPickerSheet } from '../../components/FoodPickerSheet.jsx'
import { scanToSelection } from '../../components/scan-to-selection.js'
import { addWater } from '../../components/WaterCard.jsx'
import { glassOf, useTodayDate } from '../today/use-today.js'
import { dayOf, pastWorkoutChoicesOf } from './day-data.js'

// D1.6 starts at the usual length of the planned routine, rounded to 5 minutes, else an hour.
const DEFAULT_MINUTES = 60
const DEFAULT_START = '18:00'

/** The Undo of a store change, marking the days it puts back (lib/sync-merge.js undoMarks, as
 *  Train's missed-day banner does), so another device's change in between still wins. */
function changeWithUndo(change) {
  const update = mut => useStore.getState().update(mut)
  const before = useStore.getState().S
  let done = null
  update(s => { done = change(s) })
  if (!done) return null
  const marks = undoMarks(before, useStore.getState().S)
  return () => update(s => { done.undo(s); markUndone(s, marks) })
}

/**
 * The Day page (PR07 D1) for the past day `iso`, opened under `tab`: dayOf's data (day-data.js)
 * plus what its taps do, as functions:
 *
 *   select(iso)        another day of the rail, in place (the address is replaced)
 *   openWeek()         the rail's Week link: this day's week
 *   openWorkout(w)     a workout of the day (one of `workouts`): the workout detail
 *   markSkipped()      D1.7: a missed day reads Skipped; shows the toast with Undo and returns
 *                      `{ text, undo }` (null when the day has nothing to skip)
 *   pastWorkout        D1.6's drawer: `{ iso, date, choices, time, durationMin, submit(choice) }`;
 *                      `submit({ routineIds, time, durationMin }, { before })` opens the workout
 *                      for that date (sheets submitPastWorkout), false when it cannot
 *   logFood(slot?)     Log food to this day (and meal)
 *   scan()             Scan to this day
 *   addWater()         one glass on this day (null with nutrition off)
 *   weighIn()          the weigh-in drawer for this day
 */
export function useDay(iso, tab) {
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const diary = useDiaryDay(iso)
  const units = useUnits()
  useDiaryIndex(s => s.version)
  const first = firstLogDay(S, diaryIndexDays())
  const data = dayOf({ S, iso, today, first, diary, energy: units.energy })

  const toDay = () => {
    const sel = useDiarySelection.getState()
    sel.setDate(iso)
    return sel
  }
  const planned = data.planned?.ids?.[0]
  const usual = planned ? usualDuration(S, planned) : null

  const markSkipped = () => {
    if (data.state !== 'missed') return null
    const undo = changeWithUndo(s => skipMissed(s, iso))
    if (!undo) return null
    const r = { text: t('{0} marked skipped', data.planned.name), undo }
    useUI.getState().toast(r.text, { action: t('Undo'), onAction: r.undo })
    return r
  }

  return {
    ...data,
    select: day => navToDay(day, tab, { replace: true }),
    openWeek: () => navToWeek(data.rail.week, tab),
    openWorkout: w => workoutDetailSheet(w.workout),
    markSkipped,
    pastWorkout: {
      iso, date: fmtDate(iso, true),
      choices: pastWorkoutChoicesOf(S, iso, today),
      time: DEFAULT_START,
      durationMin: usual ? Math.max(5, Math.round(usual / 60000 / 5) * 5) : DEFAULT_MINUTES,
      submit: ({ routineIds = [], time = DEFAULT_START, durationMin = DEFAULT_MINUTES } = {}, opts) =>
        submitPastWorkout({ iso, time, durationMin, routineIds }, opts),
    },
    logFood: slot => {
      const sel = toDay()
      if (slot != null) sel.setMeal(slot)
      foodPickerSheet()
    },
    scan: () => { toDay(); scanToSelection() },
    addWater: diary.on && diary.dayReady ? () => addWater(iso, glassOf(diary.settings, diary.water.goal).ml) : null,
    weighIn: () => bwSheet({ date: iso }),
  }
}
