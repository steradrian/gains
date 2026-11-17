import { Navigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { weekTargetOf } from '../../lib/day-route.js'
import { weekStartOf } from '../../lib/format.js'
import { nav } from '../../lib/nav.js'
import { TABS, TAB_ROOT } from '../../lib/tab-route.js'
import { back } from '../../lib/use-tab-nav.js'
import { useTodayDate } from '../today/use-today.js'
import { useWeek } from './use-week.js'
import WeekScreen from './WeekScreen.jsx'

// /:tab/week/:week (PR07 D2), the week named by its ISO week (`2026-W42`). A bad name, or a week
// after this one, goes back to the tab's root. Back goes down the tab's stack (‹ › and Last 4 weeks
// replace the address, so it leaves the Week page in one step), or on a cold entry to the tab's
// root (lib/tab-route.js parentOf). Trends is Training load, the app's trends page.
export default function WeekPage() {
  const { tab, week } = useParams()
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const known = TABS.includes(tab)
  if (!known || weekTargetOf(week, { today, ws: weekStartOf(S) }) !== 'week') return <Navigate to={known ? TAB_ROOT[tab] : TAB_ROOT.home} replace />
  return <WeekView isoWeek={week} tab={tab} />
}

function WeekView({ isoWeek, tab }) {
  const week = useWeek(isoWeek, tab)
  if (!week) return null
  return <WeekScreen week={week} onBack={() => back()} onTrends={() => nav('/progress/load')} />
}
