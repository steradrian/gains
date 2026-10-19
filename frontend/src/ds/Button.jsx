import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'glass']

// The design system's pill button. `primary` is the accent fill, and white inside a StageFooter
// (the stage's one solid thing to do now); `ghost` is the plain link (on-stage text inside a
// StageFooter); `glass` is the stage's second choice, a frosted pill under the white one. With
// `href` it is a link. The label names the outcome: "Save weigh-in", never OK.
// `busy` is a request in flight: a spinner before the label and a click that does nothing. It
// keeps its colour (a disabled button goes grey, which reads as unavailable, not as working). A
// busy submit button still submits, so the form's handler ignores a second submit itself.
export default function Button({ variant = 'primary', size, block, icon, iconRight, busy, className, href, type, onClick, children, ...rest }) {
  oneOf('Button', 'variant', variant, VARIANTS)
  oneOf('Button', 'size', size, ['md', 'sm'])
  const cls = cx('g-btn', 'g-btn-' + variant, size === 'sm' && 'g-btn-sm', block && 'g-btn-block', className)
  const lead = busy ? <span className="g-spin" aria-hidden="true" /> : icon && <Icon name={icon} className="g-icon" />
  const body = <>{lead}{children}{iconRight && <Icon name={iconRight} className="g-icon" />}</>
  if (href) return <a href={href} className={cls} onClick={onClick} {...rest}>{body}</a>
  return <button type={type || 'button'} className={cls} aria-busy={busy ? 'true' : undefined} onClick={busy ? undefined : onClick} {...rest}>{body}</button>
}
