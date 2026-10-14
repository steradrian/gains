import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { nutritionAvailable } from './api.js'
import { useNutrition } from './store.js'
import { calorieTarget, macroTarget, totalsOf, waterGoalOf, waterTotal } from './diary.js'

// One day of the diary as Home shows it: loads what it needs for `date` (the day, the settings,
// the activity rows when the activity section is on, and the target's inputs) and adds it up.
export function useDiaryDay(date) {
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
  const totals = totalsOf(entry?.items)
  const effective = showActivity ? activity?.sum?.effective ?? 0 : 0
  const target = calorieTarget({
    settings,
    date,
    caloriesOut: goalInputs[date] ?? null,
    adaptiveTdee: goalInputs.adaptive ?? null,
    effectiveActive: effective,
  })
  const macros = {
    proteins: macroTarget(settings, 'proteins', date, target.base),
    carbohydrates: macroTarget(settings, 'carbohydrates', date, target.base),
    fat: macroTarget(settings, 'fat', date, target.base),
  }

  return {
    on,
    status: day?.status || 'idle',
    error: day?.error || null,
    settings,
    settingsStatus: settingsState.status,
    entry,
    totals,
    target,
    macros,
    left: Math.round(target.target - totals.calories),
    water: { total: waterTotal(entry), goal: waterGoalOf(settings) },
    activityRows: activity?.rows || [],
    activitySum: activity?.sum || null,
    reload: () => useNutrition.getState().loadDay(date, { force: true }),
  }
}
