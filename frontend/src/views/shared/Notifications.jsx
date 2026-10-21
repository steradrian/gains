import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../lib/notifications/use-notifications.js'
import { back } from '../../lib/use-tab-nav.js'
import NotificationsScreen from './NotificationsScreen.jsx'

// The inbox route (PR07 N1.0, /:tab/notifications): useNotifications' feed and read state drawn by
// NotificationsScreen. Back goes down the tab's stack, or on a cold entry to the tab's root
// (lib/tab-route.js parentOf). Me › Reminders holds the reminder settings.
export default function Notifications() {
  const nav = useNavigate()
  const { sections, unreadCount, isUnread, markAllRead, open, permission, homeScreen, turnOn } = useNotifications()
  return (
    <NotificationsScreen
      sections={sections} unreadCount={unreadCount} isUnread={isUnread} permission={permission} homeScreen={homeScreen}
      onOpen={open} onMarkAllRead={markAllRead} onTurnOn={turnOn} onReminders={() => nav('/me/reminders')} onBack={() => back()}
    />
  )
}
