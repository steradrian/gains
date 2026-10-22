// The route module: every path the app has, which bottom-bar tab owns it, where its back goes on
// a cold entry, and where the paths from before the tabs went. The only source file allowed to
// spell an old path (route-literals.test.js holds the rest of src/ to that).
//
// Four tabs, each with its own stack: Home (/home), Training (/train/*), Nutrition (/food/*) and
// Me (/me/*: Profile, with Progress under it at /progress/*, which Profile's first row opens). The
// full-screen workout (/train/workout) is the one page any tab can open: it sits on top of the tab
// that opened it and belongs to none.
//
// Deep links into Progress (ux-redesign-tabs §5 item 3), each taking ?range=30|90|365|0 too:
//   /progress/body, /progress/body/measurements, /progress/body/photos   the Body page's segments
//   /progress/strength?ex=<exercise id>                                   Strength on that exercise
//   /progress/load?view=activity|muscles|fatigue|strength|effort          a Training load segment
//     (view=plan, like the old focus=weekly-volume, is replaced by /train/schedule)
//   /progress/load/muscle/<slug>                                          one muscle (lib/muscles.js MUSCLES)
// The Body segments are one page, so a cold one's back goes to Progress, not to Weight.

export const TABS = ['home', 'train', 'food', 'me']
export const TAB_ROOT = { home: '/home', train: '/train', food: '/food', me: '/me' }
export const PROGRESS_ROOT = '/progress'

// Me root M1: Profile is the Me tab's root. Its own pages sit one level under it; Settings is
// /me/settings and its pages keep /me/<page>, so everything else under /me goes back to Settings.
export const ME_ROOT = TAB_ROOT.me
export const ME_PAGES = ['body', 'goal', 'changes', 'invite', 'groups', 'notifications']
export const mePath = page => ME_ROOT + '/' + page
const SETTINGS_PATH = mePath('settings')   // views/settings/paths.js SETTINGS_ROOT; that file imports this one

// What each tab owns: its root and everything under it.
const OWNS = { home: ['/home'], train: ['/train'], food: ['/food'], me: ['/me', PROGRESS_ROOT] }

const under = (pathname, base) => pathname === base || pathname.startsWith(base + '/')

const SHARED = ['/train/workout']

export function tabOf(pathname = '') {
  if (SHARED.some(p => under(pathname, p))) return null
  return TABS.find(tab => OWNS[tab].some(base => under(pathname, base))) || null
}

export const isTabRoot = (pathname = '') => TABS.some(tab => TAB_ROOT[tab] === pathname)

// Progress and its pages: Me's, under Profile, with a root header (and search pill) of their own.
export const inProgress = (pathname = '') => under(pathname, PROGRESS_ROOT)

// Back on a cold entry (a deep link or a reload with nothing under it in its tab): the page's
// parent, one level up, down to its tab's root. The Coach goes to Training; the workout, which any
// tab opens, to Home: where it was opened from is not known any more. Progress goes to Profile,
// the page it is opened from.
export function parentOf(pathname = '') {
  if (under(pathname, '/train/coach')) return TAB_ROOT.train
  if (under(pathname, '/train/workout')) return TAB_ROOT.home
  if (pathname === PROGRESS_ROOT) return TAB_ROOT.me
  if (under(pathname, PROGRESS_ROOT + '/body')) return PROGRESS_ROOT
  // Me root M1: a page of Profile (the Body page's three tabs are one page) goes to Profile;
  // Settings too. A Settings page with nothing under it (/me/equipment, /me/admin) goes to Settings.
  const meSegments = under(pathname, ME_ROOT) ? pathname.slice(ME_ROOT.length + 1).split('/') : []
  // Groups has pages below it (a group, What you share, Cheers): those go to Groups, below.
  const belowGroups = meSegments[0] === 'groups' && meSegments.length > 1
  if (ME_PAGES.includes(meSegments[0]) && !belowGroups) return ME_ROOT
  if (pathname === SETTINGS_PATH) return ME_ROOT
  const tab = tabOf(pathname)
  // A Day or Week page (lib/day-route.js) has no page above it but its tab's root.
  if (tab && /^\/[a-z]+\/(day|week)\/[^/]+$/.test(pathname)) return TAB_ROOT[tab]
  if (meSegments.length === 1 && meSegments[0]) return SETTINGS_PATH
  // An editor in My foods (/food/my-foods/foods/12, also /new) goes back to its tab of the list.
  const editor = pathname.match(/^\/food\/my-foods\/(foods|meals|recipes)\/[^/]+$/)
  if (editor) return '/food/my-foods?tab=' + editor[1]
  // Friends (Groups, under Me): a member's or a challenge's page goes back to its group, and the
  // join page to Groups, not to a path segment that is no page.
  const ofGroup = pathname.match(/^(\/me\/groups\/[^/]+)\/(?:member|challenge)\/[^/]+$/)
  if (ofGroup) return ofGroup[1]
  if (/^\/me\/groups\/join\/[^/]+$/.test(pathname)) return '/me/groups'
  if (!tab || pathname === TAB_ROOT[tab]) return TAB_ROOT.home
  return pathname.slice(0, pathname.lastIndexOf('/'))
}

// How deep a page sits: a tab's root is 1, a page pushed from it 2, and so on up parentOf's chain
// (a Day or Week page is 2, Progress 2 under Me, Body under Progress 3). Page slides read it
// (lib/route-transition.js). The workout belongs to no tab and opens over whichever one is on
// screen, so it is deeper than anything: going into it always reads forward, leaving it back. A
// path no tab owns is 0.
export const WORKOUT_DEPTH = 1000
export function routeDepth(pathname = '') {
  if (under(pathname, '/train/workout')) return WORKOUT_DEPTH
  if (!tabOf(pathname)) return 0
  let depth = 1
  for (let at = pathname; !isTabRoot(at) && depth < 12; at = parentOf(at)) depth++
  return depth
}

// Profile pages the §5 merge renamed, old id → new id. /me/<old> and /settings/<old> land on the
// new page (views/Settings.jsx SettingsRoute, and LEGACY below). Data & backup lands on Backup, the
// page with its export and import.
// The reminder settings are at /me/reminders again (PR07 decision 2), so /settings/reminders needs
// no rename: it lands there through /settings below.
// Timer alerts folded into Workout screen (PR-06 train-m1): "When a rest ends" is a section there.
// The Danger zone's Start over lives on Account and data now (PR-06).
export const PROFILE_RENAMED = { look: 'appearance', plan: 'schedule', data: 'backup', alerts: 'workout', danger: 'account' }

// The notifications inbox (PR07 N1.0) is pushed under the tab its bell was tapped on, so the lit
// tab and Back stay where you were: /home/notifications, /train/notifications, … A page no tab
// owns (the workout) opens Home's. /me/notifications, the reminder settings' old address, is Me's
// inbox now, so the links already out there still open something that makes sense.
export const notificationsPath = (pathname = '') => '/' + (tabOf(pathname) || 'home') + '/notifications'
export const isNotificationsPath = (pathname = '') => TABS.some(tab => pathname === '/' + tab + '/notifications')

// Routes from before the tabs, still reachable from bookmarks, home-screen shortcuts and the links
// already sitting in delivered notifications (the server's Coach push says #/coach). Longest
// prefix first: /plan/r/:id is a routine, /plan the week, /settings/look before /settings.
const LEGACY = [
  ...Object.entries(PROFILE_RENAMED).map(([from, to]) => ['/settings/' + from, '/me/' + to]),
  ['/plan/r', '/train/routines'],
  ['/plan', '/train/schedule'],
  ['/checkin', '/train/checkin'],
  ['/workout', '/train/workout'],
  ['/history', '/train/history'],
  ['/library', '/train/exercises'],
  ['/muscles', '/train/exercises/muscles'],
  ['/coach', '/train/coach'],
  ['/stats', '/progress'],
  ['/structural-balance', '/progress/strength/balance'],
  ['/progress-photos', '/progress/body/photos'],
  ['/measurements', '/progress/body/measurements'],
  ['/body', '/progress/body'],
  ['/settings', '/me'],
  ['/admin', '/me/admin'],
]

// The whole new address for an old one, query and fragment kept. Plan's old "Weekly muscle
// volume" link (/stats?focus=weekly-volume) opens the Plan page, where the weekly volume moved.
export function legacyPath(pathname = '', search = '', hash = '') {
  if (pathname === '/stats' && /[?&]focus=weekly-volume\b/.test(search)) return '/train/schedule' + hash
  // The old Settings root: /me is Profile now, Settings is under it. (/settings/<page> is /me/<page>.)
  if (pathname === '/settings') return SETTINGS_PATH + search + hash
  for (const [from, to] of LEGACY) if (under(pathname, from)) return to + pathname.slice(from.length) + search + hash
  return null
}

// Workout ids are not pages to come back to: once the session is over the address shows the
// Start screen, so it is never kept in a tab's stack (the dock reopens a running one).
export const isWorkoutPath = (path = '') => under(path.split(/[?#]/)[0], '/train/workout')

// A live session: not a past workout being edited or logged after the fact, which has no clock.
export const workoutRunning = S => !!S?.active && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0

// Where a launch with no route of its own lands: straight into a running workout, else Home.
export const launchPath = running => (running ? '/train/workout' : TAB_ROOT.home)
