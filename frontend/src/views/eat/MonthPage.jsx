import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { dayTargetOf, firstLogDay, navToDay } from '../../lib/day-route.js'
import { weekStartOf } from '../../lib/format.js'
import { diaryIndexDays, startDiaryIndex, useDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { loadErrorText } from '../../lib/nutrition/log-feedback.js'
import { useToday } from '../../lib/nutrition/use-freshness.js'
import { monthOf } from '../../lib/nutrition/trends.js'
import MonthScreen from './MonthScreen.jsx'
import { useFoodHistory } from './use-food-history.js'

// /food/month (PR04 E1.1): the month named by `?month=2026-10` (this month without it, or with a
// name that is no month or lies ahead). ‹ › replace the address, so Back leaves Month in one step.
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}
const lastDay = month => {
  const [y, m] = month.split('-').map(Number)
  return month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0')
}

export default function MonthPage() {
  const S = useStore(s => s.S)
  const [params, setParams] = useSearchParams()
  const thisMonth = useToday().slice(0, 7)
  const asked = params.get('month')
  const month = asked && MONTH.test(asked) && asked <= thisMonth ? asked : thisMonth
  const history = useFoodHistory({ from: month + '-01', to: lastDay(month) })
  const { today, status } = history
  useDiaryIndex(s => s.version)
  useEffect(() => { if (status !== 'off') startDiaryIndex() }, [status])
  const first = firstLogDay(S, diaryIndexDays())
  const weekStart = weekStartOf(S)

  const data = monthOf({
    month, days: history.days, settings: history.settings, goalInputs: history.goalInputs, activity: history.activity, tried: history.tried,
    weekStart, openOf: iso => dayTargetOf(iso, { today, first }),
  })

  if (status === 'off') return <Navigate to="/food" replace />
  const go = by => setParams({ month: shiftMonth(month, by) }, { replace: true })
  return (
    <MonthScreen
      data={data} status={status} errorText={status === 'error' ? loadErrorText(history.error) : undefined} today={today} weekStart={weekStart}
      onPrev={first && month > first.slice(0, 7) ? () => go(-1) : undefined}
      onNext={month < thisMonth ? () => go(1) : undefined}
      onDay={iso => navToDay(iso)}
      onRetry={history.reload}
    />
  )
}
