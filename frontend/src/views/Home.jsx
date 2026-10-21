import { useFirstHome } from '../lib/onboarding/handover.js'
import TodayScreen from './today/TodayScreen.jsx'
import { useToday } from './today/use-today.js'

// Today, the first tab (PR-01): always today, on the stage. Its data is useToday's; TodayScreen
// draws it. Straight from the onboarding Summary its sections come in once, never on a tab visit.
export default function Home() {
  useFirstHome()
  return <TodayScreen {...useToday()} />
}
