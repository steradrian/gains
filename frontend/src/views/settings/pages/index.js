import { lazy } from 'react'

// Page id → the component that draws it, for every entry of settings-pages.js PAGES that renders
// inside Settings. A page milestone replaces its file (and its entry here if the file is renamed);
// nothing else in Settings changes. `equipment` is Gym setup, which SettingsRoute renders itself.
const LOADERS = {
  appearance: () => import('./AppearancePage.jsx'),
  units: () => import('./UnitsPage.jsx'),
  reminders: () => import('./RemindersPage.jsx'),
  features: () => import('./FeaturesPage.jsx'),
  health: () => import('./HealthPage.jsx'),
  workout: () => import('./WorkoutPage.jsx'),
  advanced: () => import('./FineTunePage.jsx'),
  schedule: () => import('./SchedulePage.jsx'),
  diary: () => import('./DiaryPage.jsx'),
  water: () => import('./WaterPage.jsx'),
  foods: () => import('./FoodsPage.jsx'),
  sources: () => import('./SourcesPage.jsx'),
  categories: () => import('./CategoriesPage.jsx'),
  customUnits: () => import('./CustomUnitsPage.jsx'),
  backup: () => import('./BackupPage.jsx'),
  import: () => import('./ImportPage.jsx'),
  media: () => import('./MediaPage.jsx'),
  danger: () => import('./DangerPage.jsx'),
  about: () => import('./AboutPage.jsx'),
  licences: () => import('./LicencesPage.jsx'),
  account: () => import('./AccountPage.jsx'),
}

// Pages that draw their own frame (SettingsPage: nav bar, large title) instead of sitting under the
// host's old page header. Each page milestone adds its ids and, in the same pass, nothing else.
// Settings train m1:
export const OWN_FRAME = new Set(['workout', 'advanced', 'schedule'])
export const drawsOwnFrame = id => OWN_FRAME.has(id)

export const PAGE_COMPONENTS =Object.fromEntries(Object.entries(LOADERS).map(([id, load]) => [id, lazy(load)]))

// Pages whose module is already loaded (preloadPages): drawn at once instead of suspending.
const loaded = {}

/** The component for a page id: the loaded one if there is one, else the lazy one. */
export const pageComponent = id => loaded[id] || PAGE_COMPONENTS[id] || null

/**
 * Loads pages ahead of their first draw. The app never needs it (a page loads when opened);
 * the Settings tests call it once so a mount draws the page in the same act() that mounts it.
 */
export async function preloadPages(ids = Object.keys(LOADERS)) {
  await Promise.all(ids.map(async id => { loaded[id] = (await LOADERS[id]()).default }))
}
