import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// The design system's dark toast (bundle.js `UndoToast`): a lead glyph, the message naming the day
// and meal it wrote to, Undo, and a bar draining over `duration` seconds. `actionLabel` (with
// `actionHref`/`onAction`) names another action than Undo; `onUndo={false}` hides the button,
// `icon={null}` the glyph, `duration={false}` the bar. `paused` holds the bar where it is, and a new
// `restartKey` starts it over (and gives the button a fresh element). `body` is a second, quieter
// line under the message (what else went with a deleted workout). `dismissLabel` adds a visually
// hidden close button named by it; the owner of the toast puts the toast away on its click (it
// bubbles), on a swipe and on Escape (components/use-swipe-dismiss.js).
//
// This only draws. The app's one toast (components/Toast.jsx, useUI.toast) draws through it and
// owns the timing, the presence motion and the focus; `role` is null there, its #toast is the live
// region. Under reduced motion the bar stands still (ds.css).
export default function UndoToast({
  message, children, body, onUndo, undoHref, undoLabel, actionLabel, actionHref, onAction,
  icon = 'check', duration = 8, paused = false, restartKey, role = 'status', className, ref, dismissLabel, ...rest
}) {
  const action = onUndo !== false
  return (
    <div ref={ref} {...rest} role={role} className={cx('g-utoast', className)}>
      <div className="g-utoast-row">
        {icon && <span className="g-utoast-ic" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>}
        <span className="g-utoast-msg">{message ?? children}{body && <span className="g-utoast-body">{body}</span>}</span>
        {action && <Act key={restartKey} href={undoHref || actionHref} onClick={onUndo || onAction} className="g-utoast-undo">
          {actionLabel || undoLabel || t('Undo')}
        </Act>}
        {dismissLabel && <button type="button" data-dismiss className="g-utoast-x">{dismissLabel}</button>}
      </div>
      {action && duration && <span key={restartKey} className={cx('g-utoast-drain', paused && 'g-utoast-paused')}
        style={{ '--dur': `${duration}s` }} aria-hidden="true" />}
    </div>
  )
}
