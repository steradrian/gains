import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger']

// The design system's pill button. `primary` is the accent fill, and white inside a StageFooter
// (the stage's one solid thing to do now); `ghost` is the plain link (on-stage text inside a
// StageFooter). With `href` it is a link. The label names the outcome: "Save weigh-in", never OK.
export default function Button({ variant = 'primary', size, block, icon, iconRight, className, href, type, children, ...rest }) {
  oneOf('Button', 'variant', variant, VARIANTS)
  oneOf('Button', 'size', size, ['md', 'sm'])
  const cls = cx('g-btn', 'g-btn-' + variant, size === 'sm' && 'g-btn-sm', block && 'g-btn-block', className)
  const body = <>{icon && <Icon name={icon} className="g-icon" />}{children}{iconRight && <Icon name={iconRight} className="g-icon" />}</>
  if (href) return <a href={href} className={cls} {...rest}>{body}</a>
  return <button type={type || 'button'} className={cls} {...rest}>{body}</button>
}
