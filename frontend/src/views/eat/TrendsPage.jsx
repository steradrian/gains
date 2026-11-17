import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { foodPickerSheet } from '../../components/FoodPickerSheet.jsx'
import { navToDay } from '../../lib/day-route.js'
import { nav } from '../../lib/nav.js'
import { loadErrorText } from '../../lib/nutrition/log-feedback.js'
import { fastingBlockOf, foodRangeFrom, foodTrendsOf, foodWindowOf } from '../../lib/nutrition/trends.js'
import { useToday } from '../../lib/nutrition/use-freshness.js'
import { useFasting, useFastingOn } from '../../lib/nutrition/use-fasting.js'
import TrendsScreen from './TrendsScreen.jsx'
import { useFoodHistory } from './use-food-history.js'

// /food/trends?range=7|30|90 (PR04 E3.0, E3.1): 7 days without it or with any other value. The
// range lives in the address and is replaced, not pushed, so Back leaves Trends in one step. Daily
// targets opens the goals page (/food/goals, which Me's Daily targets row replaces).
export default function TrendsPage() {
  const [params, setParams] = useSearchParams()
  const range = foodRangeFrom(params.get('range'))
  const today = useToday()
  const { from, to } = foodWindowOf(range, today)
  const history = useFoodHistory({ from, to })
  const fastingOn = useFastingOn()
  const fasts = useFasting(s => s.history)
  const { status } = history
  useEffect(() => {
    if (fastingOn) useFasting.getState().load()
  }, [fastingOn])

  if (status === 'off') return <Navigate to="/food" replace />
  const data = foodTrendsOf({
    days: history.days, settings: history.settings, goalInputs: history.goalInputs, activity: history.activity, tried: history.tried, range, today,
  })
  const fasting = fastingOn ? fastingBlockOf({ history: fasts, since: new Date(from + 'T00:00:00').getTime(), now: Date.now() }) : null
  return (
    <TrendsScreen
      data={data} status={status} errorText={status === 'error' ? loadErrorText(history.error) : undefined} fasting={fasting}
      onRange={next => setParams({ range: String(next) }, { replace: true })}
      onTargets={() => nav('/food/goals')}
      onFasting={() => nav('/food/fasting')}
      onDay={iso => navToDay(iso)}
      onLog={() => foodPickerSheet()}
      onRetry={history.reload}
    />
  )
}
