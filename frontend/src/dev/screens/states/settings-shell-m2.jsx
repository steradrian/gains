import { useUI } from '../../../store/useUI.js'
import SettingsRootScreen from '../../../views/settings/SettingsRootScreen.jsx'
import { registerScreens } from '../registry.js'

// The Settings root and its search (PR-06 shell-m2, boards St1Settings, St1Search, St3Scheduled,
// St3Cancelled): the real SettingsRootScreen given fixtures, in memory only. The board's "Also
// matches" food (Ea8) is not drawn: the app has no cheap local food match from Settings.
const NOOP = () => {}
const row = (key, icon, title, sub, value) => ({ key, icon, title, sub, value, onClick: NOOP })

const GROUPS = [
  { key: 'yours', title: 'Make it yours', rows: [
    row('appearance', 'palette', 'Appearance', 'Accent, theme, background', 'Cobalt'),
    row('units', 'ruler', 'Units and language', null, 'kg · English'),
  ] },
  { key: 'track', title: 'Keep you on track', rows: [
    row('reminders', 'bell', 'Reminders', 'The notifications you set yourself', '4 on'),
    row('features', 'slider', 'Features', 'What Gains tracks for you', 'Fasting off'),
  ] },
  { key: 'training', title: 'Training', rows: [
    row('workout', 'play', 'Workout screen', 'Layout, effort, rest timer, sounds', 'Cards · RIR'),
    row('schedule', 'calendar', 'Schedule', 'How you train, week start', 'Fixed week'),
    row('equipment', 'kettlebell', 'Gym setup', 'Plates, dumbbells, profiles', '20 kg bar'),
    row('coach', 'chat', 'AI Coach', 'Plans that adapt to your week', 'Coming soon'),
    row('advanced', 'wrench', 'Fine-tuning', 'Steppers, swipe actions, shortcuts', null),
  ] },
  { key: 'food', title: 'Food', rows: [
    row('goals', 'target', 'Daily targets', 'My goal', '2,100 kcal'),
    row('diary', 'utensils', 'Diary and meals', 'Meal names, what a meal shows', '4 meals'),
    row('water', 'droplet', 'Water', 'Unit and quick containers', '250 ml'),
    row('foods', 'scanBarcode', 'Foods and scanning', 'Lists, order, barcode beep', null),
    row('sources', 'globe', 'Food sources', 'Open Food Facts', 'On'),
    row('categories', 'list', 'Categories', null, '8'),
    row('customUnits', 'ruler', 'Custom units', 'Scoop, shot, slice', '3'),
  ] },
  { key: 'data', title: 'Your data', rows: [
    row('progress', 'chart', 'Progress', null, null),
    row('backup', 'cloud', 'Sync and backup', 'fit.example.com', 'Synced'),
    row('import', 'download', 'Import', 'Strong, Hevy, FitNotes, CSV', null),
    row('account', 'personCircle', 'Account and data', 'Passkeys, devices, download, delete', null),
  ] },
  { key: 'help', title: 'Help', rows: [
    row('help', 'circleHelp', 'Help', 'How Gains works, in short answers', null),
    row('about', 'info', 'About and updates', 'Version 0.1.0, licences', null),
  ] },
]
const ADMIN = row('admin', 'crown', 'Admin', 'Users, invites, food database. Admins only', null)
const withAdmin = groups => groups.map(g => (g.key === 'help' ? { ...g, rows: [...g.rows, ADMIN] } : g))

const base = {
  account: { initial: 'A', name: 'Adrian', line: 'Admin · 2 passkeys · this iPhone', onOpen: NOOP },
  pill: { state: 'ok', label: 'All synced', trail: '2 min ago' }, onPill: NOOP,
  groups: withAdmin(GROUPS),
  search: { open: false, query: '', rows: [], onOpen: NOOP, onQuery: NOOP, onClose: NOOP },
  signOut: { title: 'Sign out', sub: 'This iPhone only', onClick: NOOP },
  footer: 'Gains 0.1.0 · settings sync to every device you sign in on.',
}

registerScreens('Settings', [
  { id: 'A1.0', title: 'Settings', note: 'Account card, sync pill, search, then the groups with what each is set to; Admin for admins.', render: () => <SettingsRootScreen {...base} /> },
  { id: 'A1.0.offline', title: 'Settings, changes waiting', note: 'Offline with 3 changes held: the pill counts them and opens Sync.',
    render: () => <SettingsRootScreen {...base} pill={{ state: 'waiting', label: '3 changes waiting', trail: null }} /> },
  { id: 'A1.0.nonadmin', title: 'Settings, not an admin', note: 'No Admin row.', render: () => <SettingsRootScreen {...base} groups={GROUPS} /> },
  { id: 'A3.3', title: 'Deletion scheduled', note: 'The banner with Cancel deletion; sync paused.',
    render: () => <SettingsRootScreen {...base} banner={{ date: 'Sun 25 Oct', busy: false, onCancel: NOOP }} pill={{ state: 'paused', label: 'Sync paused', trail: 'deletion scheduled' }} /> },
  { id: 'A3.4', title: 'Deletion cancelled', note: 'The root restored, the toast held open.', render: () => <SettingsRootScreen {...base} />,
    play: async t => {
      await t.wait(200)
      useUI.getState().toast('Deletion cancelled. Your account stays.', { action: 'OK', onAction: NOOP })
      useUI.getState().pauseToast()
    } },
  { id: 'A1.1', title: 'Search settings', note: 'The overlay: the count, each hit with its page and a hint of what is on the row.',
    render: () => <SettingsRootScreen {...base} search={{
      open: true, query: 'the', onOpen: NOOP, onQuery: NOOP, onClose: NOOP,
      rows: [
        row('appearance:Theme', 'moon', 'Theme', 'Appearance · Dark, Light, System', null),
        row('appearance:Reduce motion', 'minimize', 'Reduce motion', 'Appearance · Off', null),
        row('appearance:Accent color', 'palette', 'Accent color', 'Appearance · 28 options', null),
      ],
    }} /> },
])
