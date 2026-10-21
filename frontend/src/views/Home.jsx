import { t } from '../lib/i18n.js'
import { useFirstHome } from '../lib/onboarding/handover.js'
import TodayScreen from './today/TodayScreen.jsx'
import { useToday } from './today/use-today.js'

// Today, the first tab (PR-01): always today, on the stage, a full-screen view that draws its own
// header (ui-guards PAGE_EXEMPT). Its data is useToday's; TodayScreen draws it. Straight from the
// onboarding Summary its sections come in once, never on a tab visit.
export default function Home() {
  useFirstHome()
  const today = useToday()
  // While the search is open the tab root's header names the page instead.
  return <>
    {!today.searching && <h1 className="sr-only">{t('Today')}</h1>}
    <TodayScreen {...today} />
  </>
}
