import { PROGRESS_ROOT } from '../../lib/tab-route.js'
import { COACH_COMING_SOON } from '../../lib/coach-availability.js'
import { PAGES, pageVisible } from '../settings-pages.js'
import { settingsPath } from './paths.js'

// The Settings root, top to bottom (boards St1Settings, A1.0): which rows each group holds, in
// what words, and where a row goes. This is the one source for the root; settings-pages.js says
// what the search finds and which pages exist on this device.
//
// A row: `id` is the page it opens (a key of PAGES, so `pageVisible` decides whether it shows) or,
// for a row that is not a page of Settings, any other id with `to` (its address) and `visible`.
// `title` and `sub` are English keys for t(). A row's value (and a line that is data) comes from
// row-values.js by `id`.
export const ROOT_GROUPS = [
  { key: 'yours', title: 'Make it yours', rows: [
    { id: 'appearance', title: 'Appearance', sub: 'Accent, theme, background', icon: 'palette' },
    { id: 'units', title: 'Units and language', icon: 'ruler' },
  ] },
  { key: 'track', title: 'Keep you on track', rows: [
    { id: 'reminders', title: 'Reminders', sub: 'The notifications you set yourself', icon: 'bell' },
    { id: 'features', title: 'Features', sub: 'What Gains tracks for you', icon: 'slider' },
  ] },
  { key: 'training', title: 'Training', rows: [
    { id: 'workout', title: 'Workout screen', sub: 'Layout, effort, rest timer, sounds', icon: 'play' },
    { id: 'schedule', title: 'Schedule', sub: 'How you train, week start', icon: 'calendar' },
    { id: 'equipment', title: 'Gym setup', sub: 'Plates, dumbbells, profiles', icon: 'kettlebell' },
    // The Coach is coming soon on every build: its page says so, so the row shows everywhere.
    { id: 'coach', title: 'AI Coach', sub: 'Plans that adapt to your week', icon: 'chat', visible: ctx => COACH_COMING_SOON || !!ctx.mobile },
    { id: 'advanced', title: 'Fine-tuning', sub: 'Steppers, swipe actions, shortcuts', icon: 'wrench' },
  ] },
  { key: 'food', title: 'Food', rows: [
    { id: 'goals', title: 'Daily targets', icon: 'target' },
    { id: 'diary', title: 'Diary and meals', sub: 'Meal names, what a meal shows', icon: 'utensils' },
    { id: 'water', title: 'Water', sub: 'Unit and quick containers', icon: 'droplet' },
    { id: 'foods', title: 'Foods and scanning', sub: 'Lists, order, barcode beep', icon: 'scanBarcode' },
    { id: 'sources', title: 'Food sources', sub: 'Open Food Facts', icon: 'globe' },
    { id: 'categories', title: 'Categories', icon: 'list' },
    { id: 'customUnits', title: 'Custom units', sub: 'Scoop, shot, slice', icon: 'ruler' },
  ] },
  { key: 'data', title: 'Your data', rows: [
    // Progress is not a tab: Me is Settings, and this is the way into it.
    { id: 'progress', title: 'Progress', icon: 'chart', to: PROGRESS_ROOT, visible: () => true },
    { id: 'backup', title: 'Sync and backup', icon: 'cloud' },
    { id: 'import', title: 'Import', sub: 'Strong, Hevy, FitNotes, CSV', icon: 'download' },
    { id: 'account', title: 'Account and data', sub: 'Passkeys, devices, download, delete', icon: 'personCircle' },
    { id: 'health', title: 'Connected apps & health', icon: 'heart' },
    { id: 'media', title: 'Photos & videos', icon: 'image' },
  ] },
  { key: 'help', title: 'Help', rows: [
    // Help has no page until the Help milestone adds it to PAGES; pageVisible keeps the row away.
    { id: 'help', title: 'Help', sub: 'How Gains works, in short answers', icon: 'circleHelp' },
    { id: 'about', title: 'About and updates', icon: 'info' },
    // Admins only (pageVisible); no count, the app has none to give.
    { id: 'admin', title: 'Admin', sub: 'Users, invites, food database. Admins only', icon: 'crown' },
  ] },
]

/**
 * Rows other boards add to a group, by group key (`yours`, `track`, ...): the Friends board's
 * Groups row goes into `yours` or `track`. A row is `{ id, title, sub, icon, to, visible }` as above;
 * `to` is its address, `visible(ctx)` its rule. Nothing is added yet.
 */
export const ROOT_ROW_SLOTS = { yours: [], track: [] }

export const rowVisible = (row, ctx) => (row.visible ? row.visible(ctx) : pageVisible(row.id, ctx))

/** Where a row goes: its own address, a page that lives in a tab (`PAGES[id].to`), else /me/<id>. */
export const rowPath = row => row.to || PAGES[row.id]?.to || settingsPath(row.id)

/** The groups that have a row on this device, in order, each with its visible rows. */
export function rootGroups(ctx, slots = ROOT_ROW_SLOTS) {
  return ROOT_GROUPS
    .map(g => ({ key: g.key, title: g.title, rows: [...g.rows, ...(slots[g.key] || [])].filter(r => rowVisible(r, ctx)) }))
    .filter(g => g.rows.length)
}
