import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { dayPath, firstLogDay, navToDay, navToWeek } from '../../lib/day-route.js'
import { exOr } from '../../lib/exercises.js'
import { fmtDate } from '../../lib/format.js'
import { skipMissed } from '../../lib/missed-day.js'
import { nav } from '../../lib/nav.js'
import { diaryIndexDays, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { useDiarySelection } from '../../lib/nutrition/selection.js'
import { useDiaryDay } from '../../lib/nutrition/use-diary-day.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { markUndone, undoMarks } from '../../lib/sync-merge.js'
import { bwSheet, exerciseDetailSheet, workoutDetailSheet } from '../../sheets.jsx'
import { foodPickerSheet } from '../../components/FoodPickerSheet.jsx'
import { openPlusSheet } from '../../components/PlusSheet.jsx'
import { addWater } from '../../components/WaterCard.jsx'
import { glassOf, useTodayDate } from '../today/use-today.js'
import { dayOf } from './day-data.js'
import { pastWorkoutSheet } from './PastWorkoutSheet.jsx'

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
 *   openWeek(week?)    the rail's Week link: the ISO week on show (this day's by default)
 *   openWorkout(w)     a workout of the day (one of `workouts`): the workout detail
 *   openExercise(e)    an exercise of a workout: its detail
 *   markSkipped()      D1.7: a missed day reads Skipped; shows the toast with Undo and returns
 *                      `{ text, undo }` (null when the day has nothing to skip)
 *   addPastWorkout()   D1.6, Add past workout for this day
 *   add()              D1.5, the + sheet logging to this day
 *   logFood(slot?)     Log food to this day (and meal)
 *   addWater()         one glass on this day (null with nutrition off or the day not in yet)
 *   weighInSheet()     the weigh-in drawer for this day
 *   openMeasurements() the measurements page
 */
export function useDay(iso, tab) {
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const diary = useDiaryDay(iso)
  const units = useUnits()
  useDiaryIndex(s => s.version)
  const first = firstLogDay(S, diaryIndexDays())
  const data = dayOf({ S, iso, today, first, diary, energy: units.energy })

  const markSkipped = () => {
    if (data.state !== 'missed') return null
    const undo = changeWithUndo(s => skipMissed(s, iso))
    if (!undo) return null
    const r = { text: t('Marked {0} skipped on {1}', data.planned.name, fmtDate(iso, true)), undo }
    useUI.getState().toast(r.text, { action: t('Undo'), onAction: r.undo })
    return r
  }

  return {
    ...data,
    select: day => navToDay(day, tab, { replace: true }),
    openWeek: (week = data.rail.week) => navToWeek(week, tab),
    openWorkout: w => workoutDetailSheet(w.workout),
    openExercise: e => exerciseDetailSheet(exOr(e.id)),
    markSkipped,
    addPastWorkout: () => pastWorkoutSheet(iso),
    add: () => openPlusSheet(dayPath(iso, tab)),
    logFood: slot => {
      const sel = useDiarySelection.getState()
      sel.setDate(iso)
      if (slot != null) sel.setMeal(slot)
      foodPickerSheet()
    },
    addWater: diary.on && diary.dayReady ? () => addWater(iso, glassOf(diary.settings, diary.water.goal).ml) : null,
    // Not `weighIn`: that is the day's weigh-in, from dayOf.
    weighInSheet: () => bwSheet({ date: iso }),
    openMeasurements: () => nav('/progress/body/measurements'),
  }
}
