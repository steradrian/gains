import { Page } from '../../components/layout.jsx'
import { t } from '../../lib/i18n.js'
import { useNotifications } from '../../lib/notifications/use-notifications.js'

// The inbox route (PR07 N1.0, /:tab/notifications) in plain markup, so the route and its data work
// before the boards are built; the notifications slice's M3 replaces it.
export default function Notifications() {
  const { sections, unreadCount, markAllRead, open, permission, turnOn } = useNotifications()
  const groups = [
    { key: 'new', title: t('New'), list: sections.new },
    { key: 'week', title: t('This week'), list: sections.thisWeek },
    { key: 'earlier', title: t('Earlier'), list: sections.earlier },
  ].filter(g => g.list.length)
  return (
    <Page title={t('Notifications')}>
      {permission === 'off' && <button type="button" onClick={turnOn}>{t('Turn on')}</button>}
      {unreadCount > 0 && <button type="button" onClick={markAllRead}>{t('Mark all read')}</button>}
      {groups.length ? groups.map(g => (
        <section key={g.key} aria-label={g.title}>
          <h2>{g.title}</h2>
          <ul>
            {g.list.map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => open(item)}>
                  <strong>{item.title}</strong> {item.body}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )) : <p>{t('Nothing new')}</p>}
    </Page>
  )
}
