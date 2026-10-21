import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

// A small label (bundle.js `Tag`): `glass` on the stage, the others on a light surface.
export default function Tag({ tone = 'accent', icon, children }) {
  oneOf('Tag', 'tone', tone, ['accent', 'positive', 'warning', 'muted', 'glass'])
  return (
    <span className={cx('g-tag', 'g-tag-' + tone)}>
      {icon && <Icon name={icon} className="g-icon" />}
      {children}
    </span>
  )
}
