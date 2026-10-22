// Where Settings lives. The Me tab's root (Profile) is ME_ROOT; Settings is a page pushed from it,
// and every Settings page keeps its address `/me/<page>`. lib/tab-route.js owns the tab's root and
// which pages go where on a cold Back.
import { ME_ROOT, mePath } from '../../lib/tab-route.js'

export { ME_ROOT }
export const SETTINGS_ROOT = mePath('settings')

/** The address of a Settings page: `settingsPath('units')` is `/me/units`; no page is the Settings root. */
export const settingsPath = page => (page ? mePath(page) : SETTINGS_ROOT)
