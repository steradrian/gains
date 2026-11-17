import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { loggedDatesOf } from '../../lib/nutrition/trends.js'
import { useTrends } from '../../lib/nutrition/use-trends.js'
import { useFresh, useToday } from '../../lib/nutrition/use-freshness.js'

/**
 * What Month and Food trends read: every diary day (useTrends, one request, kept current), the
 * settings, and for the days with food between `from` and `to` what each day's target is worked
 * out from, the Day page's own inputs (food-target.js): a Dynamic day's burn, Adaptive's estimate
 * and, when activity adjusts the target, the day's activity. Days with nothing logged load
 * nothing. `tried` says per date that its inputs have finished loading, even if a failed read
 * kept nothing.
 *
 * `status` is 'off' (nutrition is not available to this person), 'loading', 'error' (nothing
 * to show, with `error`) or 'ready'. `reload` asks again.
 */
export function useFoodHistory({ from, to }) {
  const user = useStore(s => s.user)
  const available = nutritionAvailable(user)
  const today = useToday()
  const { status, days, error } = useTrends()
  const settingsState = useNutrition(s => s.settings)
  const goalInputs = useNutrition(s => s.goalInputs)
  const activity = useNutrition(s => s.activity)
  const settings = settingsState.data
  const mode = settings?.calorieGoalMode
  const adjust = !!settings?.diaryShowActivity && !!settings?.calorieAdjustFromActivity
  const policy = settings?.manualActivityPolicy
  const [done, setDone] = useState({})

  useFresh(useTrends, available, today)
  useEffect(() => {
    if (available) useNutrition.getState().loadSettings()
  }, [available])

  const logged = useMemo(() => loggedDatesOf(days, from, to), [days, from, to])
  const key = logged.join(',')
  useEffect(() => {
    if (!available || settingsState.status !== 'ready' || !logged.length) return undefined
    let live = true
    const n = useNutrition.getState()
    Promise.all(logged.map(async date => {
      await n.loadGoalInputs(date, mode)
      if (adjust && !n.activity[date]) await n.loadActivity(date, policy)
    })).then(() => {
      if (live) setDone(was => ({ ...was, ...Object.fromEntries(logged.map(d => [`${d}|${mode}`, true])) }))
    })
    return () => { live = false }
    // `logged` is read through its key: the same days are not loaded again.
  }, [available, settingsState.status, key, mode, adjust, policy])

  const tried = Object.fromEntries(logged.map(d => [d, !!done[`${d}|${mode}`]]))
  let state = 'ready'
  if (!available) state = 'off'
  else if (status === 'error' && !days.length) state = 'error'
  else if (status !== 'ready' || !settings) state = settingsState.status === 'error' && status === 'ready' ? 'error' : 'loading'

  return {
    status: state,
    error: error || settingsState.error,
    days, settings, goalInputs, activity, tried, today,
    reload: () => {
      useTrends.getState().load({ force: true })
      useNutrition.getState().loadSettings({ force: true })
    },
  }
}
