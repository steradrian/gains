// The app has two modes, Training and Nutrition, and the mode is read off the route: everything
// under /train/* is Training, everything under /food/* is Nutrition. The shared pages (/me/*,
// /body/*, /wellness) belong to no mode of their own: they sit on top of whichever mode opened
// them, which is why modeOf() answers null for them and the shell keeps the mode it came from.

export const MODES = ['train', 'food']
export const MODE_ROOT = { train: '/train/home', food: '/food/diary' }

export function modeOf(pathname = '') {
  const seg = pathname.split('/')[1]
  return MODES.includes(seg) ? seg : null
}

// The bottom bar's four real tabs per mode, in order; the centre disc sits between the second
// and the third and is not one of them. `also` are pushed pages that keep their tab lit.
export const TABS = {
  train: [
    { path: '/train/home', also: ['/train/checkin'] },
    { path: '/train/plan' },
    { path: '/train/stats', also: ['/train/history', '/train/structural-balance'] },
    { path: '/train/library', also: ['/train/muscles'] },
  ],
  food: [
    { path: '/food/diary' },
    { path: '/food/foods' },
    { path: '/food/stats' },
    { path: '/food/goals' },
  ],
}

const under = (pathname, base) => pathname === base || pathname.startsWith(base + '/')

// Which of the mode's four tabs the route lights, or -1 for none (a shared page, the workout).
export function tabIndex(mode, pathname = '') {
  const tabs = TABS[mode] || []
  return tabs.findIndex(tab => under(pathname, tab.path) || (tab.also || []).some(p => under(pathname, p)))
}

// Bar slot of a tab: slot 2 is the centre disc, which a tab never occupies.
export const slotOf = i => (i < 2 ? i : i + 1)

// The screens a tab opens, exactly: they carry the mode switch in their header. Anything pushed
// from them (a routine, History, a settings page) shows its own back + title instead.
export function isModeRoot(pathname = '') {
  return MODES.some(mode => TABS[mode].some(tab => tab.path === pathname))
}

// Routes from before the modes, still reachable from bookmarks, home-screen shortcuts and the
// links already sitting in delivered notifications (the server's Coach push says #/coach).
const LEGACY = [
  ['/home', '/train/home'],
  ['/checkin', '/train/checkin'],
  ['/plan', '/train/plan'],
  ['/workout', '/train/workout'],
  ['/stats', '/train/stats'],
  ['/history', '/train/history'],
  ['/library', '/train/library'],
  ['/muscles', '/train/muscles'],
  ['/structural-balance', '/train/structural-balance'],
  ['/coach', '/train/coach'],
  ['/progress-photos', '/body/photos'],
  ['/measurements', '/body/measurements'],
  ['/settings', '/me'],
  ['/admin', '/me/admin'],
]

export function legacyPath(pathname = '') {
  for (const [from, to] of LEGACY) if (under(pathname, from)) return to + pathname.slice(from.length)
  return null
}

// A live session: not a past workout being edited or logged after the fact, which has no clock.
export const workoutRunning = S => !!S?.active && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0

// Where a launch with no route of its own lands: the workout that is running, else the mode
// used last, else Training.
export function launchPath({ lastMode, workoutRunning }) {
  if (workoutRunning) return '/train/workout'
  return MODE_ROOT[MODES.includes(lastMode) ? lastMode : 'train']
}
