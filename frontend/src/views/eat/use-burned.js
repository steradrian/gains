import { useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { weekKey, weekStartOf } from '../../lib/format.js'
import { navToDay } from '../../lib/day-route.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { useTodayDate } from '../today/use-today.js'
import { foodDaysOf } from '../shared/week-data.js'
import { burnedAmountSheet } from './BurnedAmountSheet.jsx'
import { burnedWeekOf, viewOf } from './burned-data.js'
import { logActivitySheet } from './ActivitySheet.jsx'

/**
 * The Burned page (PR-04 E7.0) as BurnedScreen draws it:
 *   status   'loading' | 'off' (Burned is not turned on, or there is no nutrition here: the page
 *            redirects to /food) | 'error' (the settings did not load) | 'ready'
 *   title, sub   the week's figure and where it comes from; both null for a week with no number
 *   note     { title, body } what Burned does to the target
 *   groups   [{ id, title, items }], items for GlassValueRow
 *   missing  one line per row that has no number, shown under the list
 *   empty    the week has no activity row at all
 *   onLog    opens Log activity for today
 * Burned exists only with NutriTrace's activity section on (diaryShowActivity), as the Eat root's row does.
 */
export function useBurned() {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const today = useTodayDate()
  const units = useUnits()
  const on = nutritionAvailable(user)
  const ws = weekStartOf(S)
  const settingsState = useNutrition(s => s.settings)
  const activity = useNutrition(s => s.activity)
  const goalInputs = useNutrition(s => s.goalInputs)
  const settings = settingsState.data
  const shown = !!settings?.diaryShowActivity
  const policy = settings?.manualActivityPolicy
  const mode = settings?.calorieGoalMode
  const days = useMemo(() => foodDaysOf(weekKey(today, ws), today), [today, ws])

  useEffect(() => { if (on) useNutrition.getState().loadSettings() }, [on])
  // Read again on every visit: a workout finished since, or an activity logged on another phone.
  useEffect(() => {
    if (!on || !shown) return
    const n = useNutrition.getState()
    for (const d of days) n.loadActivity(d, policy)
    n.loadGoalInputs(today, mode)
  }, [on, shown, days, policy, mode, today])

  const week = useMemo(() => burnedWeekOf({ days, today, activity }), [days, today, activity])

  let status = 'ready'
  if (!on) status = 'off'
  else if (!settings) status = settingsState.status === 'error' ? 'error' : 'loading'
  else if (!shown) status = 'off'
  else if (!week.loaded) status = 'loading'

  return {
    status,
    error: settingsState.error,
    ...viewOf({
      week, today, settings, goalInputs, energy: units.energy,
      // A row with no number opens the drawer that adds one; the others open their day.
      onAdd: row => burnedAmountSheet(row, today),
      onOpen: row => navToDay(row.date, 'food'),
    }),
    onLog: () => logActivitySheet({ date: today }),
    // Reads again only the days that failed.
    onRetry: () => {
      const n = useNutrition.getState()
      for (const d of days) if (n.activity[d]?.status === 'error') n.loadActivity(d, policy)
    },
  }
}
