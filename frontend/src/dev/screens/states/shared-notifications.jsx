import NotificationsScreen from '../../../views/shared/NotificationsScreen.jsx'
import { registerScreens } from '../registry.js'

// The Notifications page (PR-07 N1, boards Sh3Notifications, Sh3Empty, Sh3Read, Sh3PermOff): the
// real screen, NotificationsScreen, given what useNotifications() would hand it, in memory only.
// The board's first row (a Coach move) and its weigh-in reminder are left out: the app has no
// source for either yet (lib/notifications/feed.js), so the page can never show them.
const NOOP = () => {}
// Saturday 17 Oct 2026, noon: the board's today.
const NOW = new Date(2026, 9, 17, 12).getTime()
const at = (y, m, d, hh = 12, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime()

const BEST = { id: 'best:0025:w9', kind: 'best', at: at(2026, 10, 12, 19, 24), title: 'New best: Bench press', body: 'Est. 1RM 96 kg, up 4 kg in four weeks.' }
const STREAK = { id: 'streak:2026-10-05', kind: 'streak', at: at(2026, 10, 11, 23, 59), title: '6 weeks on plan', body: 'Every planned workout done or moved. Your best is 8.' }
const RECAP = { id: 'recap:2026-10-05', kind: 'recap', at: at(2026, 10, 11, 23, 59), title: 'Your week, 5 Oct – 11 Oct', body: '3 of 4 workouts · 6 of 7 days on target · −0.4 kg' }
const REMINDER = { id: 'reminder:workout:2026-10-05', kind: 'reminder', at: at(2026, 10, 5, 18), title: 'Workout today: Push A', body: 'Your 18:00 reminder.' }
const MILESTONE = { id: 'milestone:50', kind: 'milestone', at: at(2026, 10, 2, 19), title: '50 workouts', body: 'Since you started on 3 Jun.' }
const COACH = { id: 'coach:p1:c1', kind: 'coach', at: at(2026, 10, 13, 9), title: 'Coach set Thursday to Legs', body: 'See your plan' }
const READ = { new: [], thisWeek: [COACH, BEST, STREAK, RECAP], earlier: [REMINDER, MILESTONE] }
// The web app: its reminders are server pushes the inbox never sees, so no reminder row.
const READ_WEB = { new: [], thisWeek: [BEST, STREAK, RECAP], earlier: [MILESTONE] }
const NONE = { new: [], thisWeek: [], earlier: [] }

// The phone app, unless a state says otherwise.
const base = {
  now: NOW, permission: 'on', homeScreen: false, hasReminders: true,
  onOpen: NOOP, onMarkAllRead: NOOP, onTurnOn: NOOP, onReminders: NOOP, onBack: NOOP,
}
const unread = ids => item => ids.includes(item.id)

registerScreens('Shared: notifications', [
  { id: 'N1.0', title: 'Notifications', note: 'Two new (lit, with dots), then This week and Earlier; Mark all read.',
    render: () => <NotificationsScreen {...base} sections={{ new: [BEST, STREAK], thisWeek: [RECAP], earlier: [REMINDER, MILESTONE] }}
      unreadCount={2} isUnread={unread([BEST.id, STREAK.id])} /> },
  { id: 'N1.1', title: 'Nothing yet', note: 'Phone app, no item in 30 days: the bell scene and Set a reminder.',
    render: () => <NotificationsScreen {...base} sections={NONE} unreadCount={0} isUnread={() => false} /> },
  { id: 'N1.1w', title: 'Nothing yet (web)', note: 'Web app, no item in 30 days: the bell scene with no button, and no word of reminders.',
    render: () => <NotificationsScreen {...base} hasReminders={false} sections={NONE} unreadCount={0} isUnread={() => false} /> },
  { id: 'N1.2', title: 'All read', note: 'After Mark all read: the dots cleared, nothing deleted.',
    render: () => <NotificationsScreen {...base} sections={READ} unreadCount={0} isUnread={() => false} /> },
  { id: 'N1.3', title: 'Off on this phone', note: 'An iPhone browser tab: the banner with Turn on and Reminders; the list still fills, with no reminder rows.',
    render: () => <NotificationsScreen {...base} hasReminders={false} permission="off" homeScreen sections={READ_WEB} unreadCount={0} isUnread={() => false} /> },
])
