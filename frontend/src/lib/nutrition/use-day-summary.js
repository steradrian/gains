import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { nutritionAvailable } from './api.js'
import { useNutrition } from './store.js'
import { calorieTarget, macroTarget, totalsOf } from './diary.js'

// One day of the diary added up against its target, for the Nutrition hub's card: loads what it
// needs for `date` (the day, the settings, the activity and the target's inputs) and reads it.
export function useDaySummary(date) {
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const settingsState = useNutrition(s => s.settings)
  const day = useNutrition(s => s.days[date])
  const activity = useNutrition(s => s.activity[date])
  const goalInputs = useNutrition(s => s.goalInputs)
  const settings = settingsState.data
  const mode = settings?.calorieGoalMode
  const showActivity = !!settings?.diaryShowActivity
  const policy = settings?.manualActivityPolicy

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    // A cached day shows at once and is read again behind it: another device may have logged.
    n.loadDay(date, { force: true })
  }, [on, date])

  useEffect(() => {
    if (!on || settingsState.status !== 'ready') return
    const n = useNutrition.getState()
    n.loadGoalInputs(date, mode)
    n.loadActivity(date, policy)
  }, [on, date, settingsState.status, mode, policy])

  const entry = day?.entry || null
  const target = calorieTarget({
    settings,
    date,
    caloriesOut: goalInputs[date] ?? null,
    adaptiveTdee: goalInputs.adaptive ?? null,
    effectiveActive: showActivity ? activity?.sum?.effective ?? 0 : 0,
  })
  return {
    on,
    status: day?.status || 'idle',
    settings,
    entry,
    totals: totalsOf(entry?.items),
    target,
    macros: {
      proteins: macroTarget(settings, 'proteins', date, target.base),
      carbohydrates: macroTarget(settings, 'carbohydrates', date, target.base),
      fat: macroTarget(settings, 'fat', date, target.base),
    },
  }
}
