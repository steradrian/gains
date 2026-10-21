import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { dayTargetOf, firstLogDay } from '../../lib/day-route.js'
import { diaryIndexDays } from '../../lib/nutrition/diary-index.js'
import { TABS, TAB_ROOT } from '../../lib/tab-route.js'
import { Page } from '../../components/layout.jsx'
import { dayOverrideSheet } from '../../sheets.jsx'
import { useTodayDate } from '../today/use-today.js'
import { useDay } from './use-day.js'

// /:tab/day/:date (PR07 D1). The address decides first (lib/day-route.js dayTargetOf): today goes
// to Today, a day to come opens the Plan day drawer over the tab's root, a day before the first
// log or a bad address goes back to the tab's root. Links inside the app never push those (navToDay
// stops them); this covers a typed or stale address.
export default function DayPage() {
  const { tab, date } = useParams()
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const navigate = useNavigate()
  const known = TABS.includes(tab)
  const target = known ? dayTargetOf(date, { today, first: firstLogDay(S, diaryIndexDays()) }) : 'bad'
  useEffect(() => {
    if (target !== 'future') return undefined
    navigate(TAB_ROOT[tab], { replace: true })
    // Once the address is the root's: the drawer's history entry belongs to that page.
    const id = setTimeout(() => dayOverrideSheet(date), 0)
    return () => clearTimeout(id)
  }, [target, tab, date, navigate])
  if (target === 'today') return <Navigate to={TAB_ROOT.home} replace />
  if (target === 'future') return null
  if (target !== 'day') return <Navigate to={known ? TAB_ROOT[tab] : TAB_ROOT.home} replace />
  return <DayView iso={date} tab={tab} />
}

// A stand-in that proves useDay until the Day screen (PR07 M2) replaces it.
function DayView({ iso, tab }) {
  const day = useDay(iso, tab)
  return (
    <Page title={day.title} sub={day.summary}>
      <ul>
        {day.workouts.map(w => (
          <li key={w.id}><button type="button" onClick={() => day.openWorkout(w)}>{[w.name, w.line].filter(Boolean).join(' · ')}</button></li>
        ))}
      </ul>
    </Page>
  )
}
