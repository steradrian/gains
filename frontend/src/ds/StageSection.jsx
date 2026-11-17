import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// A section title on the stage (bundle.js `StageSection`) with a quiet value or link on the right:
// "See day", "1.25 of 2.5 L". The right-hand text is a link or button only when it has
// somewhere to go (`actionHref`, `onAction`); otherwise it is just said.
//
// `variant` is for the shared pages (boards Sh3*): `label` is the small uppercase heading over a
// group ("New", "This week"); `line` is the status line under a page's title, "2 new" with a glass
// "Mark all read" pill (or, with no action to take, "All read" and "Nothing unread" as plain text).
// The line is not a heading, and its text is a polite live region: when the count changes the
// change is spoken, and the pill that was there is gone, so the page moves focus itself.
export default function StageSection({ title, action, actionHref, onAction, variant }) {
  oneOf('StageSection', 'variant', variant, ['label', 'line'])
  const line = variant === 'line'
  return (
    <div className={cx('g-ssec', variant && 'g-ssec-' + variant)}>
      {line ? <span className="g-ssec-t" aria-live="polite">{title}</span> : <h2>{title}</h2>}
      {action && (actionHref || onAction
        ? <Act href={actionHref} onClick={onAction} className={cx('g-ssec-act', line && 'g-ssec-pill g-glass')}>{action}</Act>
        : <span className="g-ssec-act">{action}</span>)}
    </div>
  )
}
