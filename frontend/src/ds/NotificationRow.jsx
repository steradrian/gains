import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The tile's glyph per kind of notification, when the caller does not pick one with `icon`: a
// reminder is about something (a weigh-in, a workout), so its caller says which.
const KIND_ICONS = {
  coach: 'calendar',
  best: 'dumbbell',
  streak: 'flame',
  recap: 'chartLine',
  reminder: 'bell',
  milestone: 'trophy',
}
export const NOTIFICATION_KINDS = Object.keys(KIND_ICONS)

// One notification on the Notifications page (bundle.js `NotificationRow`, board Sh3Notifications):
// a tile (the kind's glyph, or the exercise's still for a new best), what happened, a line of
// detail and `when`, the meta line ("Coach · 2 h ago", already built and translated by the page).
// The whole row is the action: a link with `href`, a button with `onClick`; never a button inside.
// `isNew` lights the row, makes the title bold and adds the dot, and a screen reader hears "New:"
// before the title, because the dot is only a picture.
export default function NotificationRow({ kind = 'reminder', icon, image, title, body, when, isNew, href, onClick }) {
  oneOf('NotificationRow', 'kind', kind, NOTIFICATION_KINDS)
  return (
    <Act href={href} onClick={onClick} className={cx('g-nrow', isNew && 'g-nrow-new')}>
      {image
        ? <img className="g-lead g-lead-img" src={image} alt="" />
        : <span className="g-lead"><Icon name={icon || KIND_ICONS[kind] || KIND_ICONS.reminder} className="g-icon" /></span>}
      <span className="g-nrow-body">
        <b>{isNew && <span className="g-sr">{t('New')}: </span>}{title}</b>
        {body && <span>{body}</span>}
        {when && <small>{when}</small>}
      </span>
      {isNew ? <span className="g-nrow-dot" aria-hidden="true" /> : <span className="g-nrow-gap" aria-hidden="true" />}
    </Act>
  )
}
