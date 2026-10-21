import { useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { dayTargetOf, firstLogDay, navToDay, navToWeek, weekStartOfId } from '../../lib/day-route.js'
import { weekStartOf } from '../../lib/format.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { diaryIndexDays } from '../../lib/nutrition/diary-index.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useTodayDate } from '../today/use-today.js'
import { foodDaysOf, weekOf } from './week-data.js'

/**
 * The Week page (PR07 D2) for the week `isoWeek` (`2026-W42`), opened under `tab`: weekOf's data
 * (week-data.js), or null for a name that is no week, plus what its taps do:
 *
 *   openDay(iso)       a day cell: its Day page; today opens Today, a day to come the Plan day drawer
 *   openWeek(isoWeek)  ‹ ›, or a week of Last 4 weeks: that week, in place (the address is replaced)
 *
 * Each cell also carries `open`, what tapping it does (dayTargetOf: 'day', 'today', 'future' or
 * 'before', which opens nothing), and `foodOn` says whether nutrition is on at all.
 *
 * With nutrition on it loads the week's diary days up to today (each once; a cached day is not read
 * again), the settings and what a Dynamic or Adaptive target needs, so the cells and numbers fill
 * in as they land.
 */
export function useWeek(isoWeek, tab) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const today = useTodayDate()
  const on = nutritionAvailable(user)
  const settingsState = useNutrition(s => s.settings)
  const days = useNutrition(s => s.days)
  const goalInputs = useNutrition(s => s.goalInputs)
  const start = weekStartOfId(isoWeek, weekStartOf(S))
  const settings = settingsState.data
  const mode = settings?.calorieGoalMode

  const loadDays = useMemo(() => (start ? foodDaysOf(start, today) : []), [start, today])
  useEffect(() => {
    if (!on || !loadDays.length) return
    const n = useNutrition.getState()
    n.loadSettings()
    for (const d of loadDays) n.loadDay(d)
  }, [on, loadDays])
  useEffect(() => {
    if (!on || settingsState.status !== 'ready') return
    const n = useNutrition.getState()
    for (const d of loadDays) n.loadGoalInputs(d, mode)
  }, [on, loadDays, settingsState.status, mode])

  const entries = {}
  for (const d of loadDays) if (days[d]?.status === 'ready') entries[d] = days[d].entry || null
  const data = weekOf({ S, isoWeek, today, food: { on, settings, entries, goalInputs } })
  if (!data) return null
  const first = firstLogDay(S, diaryIndexDays())
  return {
    ...data,
    foodOn: on,
    cells: data.cells.map(c => ({ ...c, open: dayTargetOf(c.iso, { today, first }) })),
    openDay: iso => navToDay(iso, tab),
    openWeek: id => navToWeek(id, tab, { replace: true }),
  }
}
