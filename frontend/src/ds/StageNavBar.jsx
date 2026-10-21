import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// The bar on top of every pushed page on the stage (boards Sh3Notifications, Sh1Day, Sh2Week; the
// design system has no function for it): a glass Back, the title centred, and glass icon buttons
// at the end, `actions: [{ icon, label, onClick, href }]`, each named by its outcome ("Reminder
// settings"). Back is a button with `onBack`, or a link with `backHref`; its spoken name is
// "Back" unless `backLabel` says where it goes. It sticks under the status bar (--sat) while the
// page scrolls. A page whose large title sits below the bar passes no `title`, and the bar keeps
// the middle empty. Both sides are the same width, so the title stays centred with up to two
// actions; with no `onBack` or `backHref` the page is a root and shows no Back.
export default function StageNavBar({ title, onBack, backHref, backLabel, actions = [] }) {
  return (
    <nav className="g-snav">
      <span className="g-snav-side">
        {(onBack || backHref) && (
          <Act href={backHref} onClick={onBack} ariaLabel={backLabel || t('Back')} className="g-snav-btn g-snav-back g-glass">
            <Icon name="chevronLeft" className="g-icon" />
          </Act>
        )}
      </span>
      {title ? <h1 className="g-snav-title">{title}</h1> : <span />}
      <span className="g-snav-side g-snav-end">
        {actions.map((a, i) => (
          <Act key={a.label + i} href={a.href} onClick={a.onClick} ariaLabel={a.label} className="g-snav-btn g-glass">
            <Icon name={a.icon} className="g-icon" />
          </Act>
        ))}
      </span>
    </nav>
  )
}
