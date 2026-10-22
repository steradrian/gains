import SettingsPageHost from './settings/SettingsPageHost.jsx'
import SettingsRoot from './settings/SettingsRoot.jsx'
import { PAGE_COMPONENTS } from './settings/pages/index.js'

// Settings at /me and /me/<page> (route: settings/SettingsRoute.jsx). `page` is the open page
// (null for the root), `find` a row a search hit asked for, which is scrolled to and flashed.
// A page with a component is drawn by SettingsPageHost; everything else is the root.
export default function Settings({ page = null, find = null, via = null }) {
  if (page && PAGE_COMPONENTS[page]) return <SettingsPageHost page={page} find={find} via={via} />
  return <SettingsRoot find={find} via={via} />
}
