import { Navigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { weekTargetOf } from '../../lib/day-route.js'
import { weekStartOf } from '../../lib/format.js'
import { TABS, TAB_ROOT } from '../../lib/tab-route.js'
import { Page } from '../../components/layout.jsx'
import { useTodayDate } from '../today/use-today.js'
import { useWeek } from './use-week.js'

// /:tab/week/:week (PR07 D2), the week named by its ISO week (`2026-W42`). A bad name, or a week
// after this one, goes back to the tab's root.
export default function WeekPage() {
  const { tab, week } = useParams()
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const known = TABS.includes(tab)
  if (!known || weekTargetOf(week, { today, ws: weekStartOf(S) }) !== 'week') return <Navigate to={known ? TAB_ROOT[tab] : TAB_ROOT.home} replace />
  return <WeekView isoWeek={week} tab={tab} />
}

// A stand-in that proves useWeek until the Week screen (PR07 M3) replaces it.
function WeekView({ isoWeek, tab }) {
  const week = useWeek(isoWeek, tab)
  if (!week) return null
  return (
    <Page title={week.range} sub={week.status}>
      <ul>
        {week.cells.map(c => (
          <li key={c.iso}><button type="button" onClick={() => week.openDay(c.iso)}>{c.dow} {c.date}</button></li>
        ))}
      </ul>
    </Page>
  )
}
