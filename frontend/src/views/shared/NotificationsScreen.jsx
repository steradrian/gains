import { useRef } from 'react'
import { t, tn } from '../../lib/i18n.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { whenOf } from '../../lib/notifications/when.js'
import GlassList from '../../ds/GlassList.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import NotificationGroup from '../../ds/NotificationGroup.jsx'
import NotificationRow from '../../ds/NotificationRow.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNavBar from '../../ds/StageNavBar.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePageTitle from '../../ds/StagePageTitle.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import StageSection from '../../ds/StageSection.jsx'
import './notifications.css'

// What the page says it holds. Friends is named only while it is on, because that is when cheers
// and invites can land here.
const linesOf = (hasReminders, friends) => {
  if (friends) {
    return hasReminders
      ? { line: t('Reminders you set, streaks, new bests, Coach changes and Friends'), empty: t('Reminders you set, streaks, new bests, Coach changes and Friends show up here.') }
      : { line: t('Streaks, new bests, Coach changes and Friends'), empty: t('Streaks, new bests, Coach changes and Friends show up here.') }
  }
  return hasReminders
    ? { line: t('Reminders you set, streaks, new bests and Coach changes'), empty: t('Reminders you set, streaks, new bests and Coach changes show up here.') }
    : { line: t('Streaks, new bests and Coach changes'), empty: t('Streaks, new bests and Coach changes show up here.') }
}

// The Notifications page on the stage (boards Sh3Notifications, Sh3Empty, Sh3Read, Sh3PermOff),
// pushed under the tab whose bell opened it. It draws what useNotifications() gives it and holds
// nothing: the sections New / This week / Earlier, the "2 new · Mark all read" line (only while something
// is unread), a Reminders row at the end when the permission banner is not there to link to them,
// the permission banner when this phone won't buzz (the list still fills), and
// the empty scene when there is nothing at all. `now` dates the meta lines. `hasReminders`: only
// the phone app's reminders land here, so off it the page never promises them, and the empty
// scene has no "Set a reminder" that could not fill it.
//
// The large title is the page's h1 (StagePageTitle; the nav bar above it has none). Mark all read
// takes its own pill away, so focus moves to that heading. `friends`: Friends is on, so cheers and
// invites can land here and the copy names it.
export default function NotificationsScreen({
  sections, unreadCount, isUnread, now = Date.now(), permission, homeScreen, hasReminders, friends = false,
  onOpen, onMarkAllRead, onTurnOn, onReminders, onBack,
}) {
  const accent = useDsAccent()
  const heading = useRef(null)
  const groups = [
    { key: 'new', title: t('New'), list: sections.new },
    { key: 'week', title: t('This week'), list: sections.thisWeek },
    { key: 'earlier', title: t('Earlier'), list: sections.earlier },
  ].filter(g => g.list.length)
  const empty = !groups.length
  const lines = linesOf(hasReminders, friends)
  const markAll = () => {
    onMarkAllRead()
    heading.current?.focus()
  }

  return (
    <StageScreen accent={accent}>
      <div className="notif">
        <StageNavBar onBack={onBack} actions={[{ icon: 'gear', label: t('Reminder settings'), onClick: onReminders }]} />
        <StagePageTitle ref={heading} title={t('Notifications')}
          line={empty ? null : lines.line} />
        {permission === 'off' && (
          <div className="g-sbanner">
            <InlineBanner stage icon="bellSlash" title={t('Notifications are off on this phone')}
              body={t('They still land here, but your phone won’t buzz.') + (homeScreen ? ' ' + t('On iPhone, add Gains to the Home Screen first.') : '')}
              actions={[{ label: t('Turn on'), solid: true, onClick: onTurnOn }, { label: t('Reminders'), onClick: onReminders }]} />
          </div>
        )}
        {empty
          ? hasReminders
            ? <StageEmpty card={false} illustration="bell" title={t('Nothing new')} body={lines.empty}
              action={t('Set a reminder')} onClick={onReminders} />
            : <StageEmpty card={false} illustration="bell" title={t('Nothing new')} body={lines.empty} />
          : <>
            {unreadCount > 0 && <StageSection variant="line" title={tn('{0} new', '{0} new', unreadCount)} action={t('Mark all read')} onAction={markAll} />}
            {groups.map(g => (
              <NotificationGroup key={g.key} title={g.title}>
                {g.list.map(item => (
                  <NotificationRow key={item.id} kind={item.kind} title={item.title} body={item.body} when={whenOf(item, now)}
                    isNew={isUnread(item)} onClick={() => onOpen(item)} />
                ))}
              </NotificationGroup>
            ))}
            {permission !== 'off' && hasReminders && (
              <div className="notif-rem">
                <GlassList items={[{ icon: 'bell', title: t('Reminders'), onClick: onReminders }]} />
              </div>
            )}
            <StageNote>{t('Kept for 30 days.')}</StageNote>
          </>}
      </div>
    </StageScreen>
  )
}
