import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import { useFocusOnMount } from './use-focus-on-mount.js'

// A notice inside a screen or a drawer (bundle.js `InlineBanner`): icon, a title, a line under it,
// optional actions. `stage` is glass for the stage; otherwise `tone` colours it on a light
// surface. `role="alert"` is for what just went wrong, and then it also takes focus (key it per
// failure); the default `status` is a notice that was there to begin with.
export default function InlineBanner({ icon = 'info', title, body, actions, stage, tone = 'accent', role = 'status' }) {
  oneOf('InlineBanner', 'tone', tone, ['accent', 'warning', 'muted'])
  const alert = role === 'alert'
  const ref = useFocusOnMount(alert)
  return (
    <div ref={ref} role={role} tabIndex={alert ? -1 : undefined} className={cx('g-ibanner', stage ? 'g-glass g-ibanner-stage' : 'g-ibanner-' + tone)}>
      <div className="g-ibanner-row">
        <span className="g-ibanner-ic"><Icon name={icon} className="g-icon" /></span>
        <span className="g-ibanner-body"><b>{title}</b>{body && <span>{body}</span>}</span>
      </div>
      {actions?.length > 0 && (
        <div className="g-ibanner-acts">
          {actions.map(a => <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-ibanner-btn', a.solid && 'g-ibanner-solid')}>{a.label}</Act>)}
        </div>
      )}
    </div>
  )
}
