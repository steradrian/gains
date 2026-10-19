import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'
import { useFocusOnMount } from './use-focus-on-mount.js'

// One line of bad news on the stage, in glass: it shakes once as it arrives (switched off under
// reduced motion, ds.css) and takes focus, so key it per failure. `action` is the chip at its end
// ("Having trouble?"), a link with `actionHref`, a button with `onAction`.
export default function StageAlert({ icon = 'info', action, actionHref, onAction, children }) {
  const ref = useFocusOnMount()
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="g-salert g-glass">
      <Icon name={icon} className="g-icon" />
      <span className="g-salert-text">{children}</span>
      {action && <Act href={actionHref} onClick={onAction} className="g-salert-chip g-glass">{action}</Act>}
    </div>
  )
}
