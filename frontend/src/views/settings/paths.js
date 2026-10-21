// Where Settings lives. One constant, so moving it later (owner question Q8) is a one-line change.
// lib/tab-route.js owns the Me tab's root; this is the address of the Settings root inside it.
export const SETTINGS_ROOT = '/me'

/** The address of a Settings page: `settingsPath('units')` is `/me/units`; no page is the root. */
export const settingsPath = page => (page ? SETTINGS_ROOT + '/' + page : SETTINGS_ROOT)
