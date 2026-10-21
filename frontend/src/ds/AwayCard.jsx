import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The welcome-back card on Today, on the stage (bundle.js `AwayCard`, in the form board T1.10
// draws: one glass card with a message and up to two buttons, not the light list of fixes).
// actions: [{ label, href, onClick, solid }]; the solid one is the white button, the rest are
// glass. It shows once after days away; the screen decides when and what "Not now" does.
export default function AwayCard({ icon = 'hand', title, body, actions = [] }) {
  return (
    <div className="g-away g-glass">
      <div className="g-away-row">
        <span className="g-away-ic"><Icon name={icon} className="g-icon" /></span>
        <span className="g-away-body"><b>{title}</b>{body && <span>{body}</span>}</span>
      </div>
      {actions.length > 0 && (
        <div className="g-away-acts">
          {actions.map(a => <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-away-btn', a.solid && 'g-away-solid')}>{a.label}</Act>)}
        </div>
      )}
    </div>
  )
}
