import { useParams, useLocation, Navigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { PROFILE_RENAMED } from '../../lib/tab-route.js'
import { MOBILE } from '../../lib/mobile.js'
import GymSetup from '../train/gym/GymSetup.jsx'
import Settings from '../Settings.jsx'
import { PAGES, pageExists, pageVisible } from '../settings-pages.js'
import { SETTINGS_ROOT, settingsPath } from './paths.js'

// The route: /me/settings (`root`) and /me/<page>. A page renamed by the §5 merge goes to its new name (tab-route.js);
// a page that lives in a tab (the phone's Coach setup) goes there; an unknown page, or one this
// device does not have, goes back to the root. Keyed on the history entry too, so a search hit for
// a row on the root itself, which lands on the same path, flashes it every time.
export function SettingsRoute({ root = false }) {
  const params = useParams()
  const page = root ? undefined : params.page
  const loc = useLocation()
  const ctx = { user: useStore(s => s.user), mobile: MOBILE }
  if (page && PROFILE_RENAMED[page]) return <Navigate to={settingsPath(PROFILE_RENAMED[page])} replace state={loc.state} />
  if (page && PAGES[page]?.to && pageVisible(page, ctx)) return <Navigate to={PAGES[page].to} replace />
  if (page && !pageExists(page, ctx)) return <Navigate to={SETTINGS_ROOT} replace />
  // Equipment is Gym setup (Train slice 6, T12.0): the same page Train opens, on the stage.
  if (page === 'equipment') return <GymSetup key={loc.key} find={loc.state?.find || null} />
  return <Settings key={(page || 'root') + ':' + loc.key} page={page || null} find={loc.state?.find || null} via={loc.state?.via || null} />
}
