import Icon from '../components/Icon.jsx'
import { haptic as buzz } from '../lib/use-haptic.js'
import { cx, oneOf } from '../lib/ui-kit.js'
import HapticSwitch, { isHapticSwitchTarget } from './HapticSwitch.jsx'

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'glass']

// The design system's pill button. `primary` is the accent fill, and white inside a StageFooter
// (the stage's one solid thing to do now); `ghost` is the plain link (on-stage text inside a
// StageFooter); `glass` is the stage's second choice, a frosted pill under the white one. With
// `href` it is a link. The label names the outcome: "Save weigh-in", never OK.
// `busy` is a request in flight: a spinner before the label and a click that does nothing. It
// keeps its colour (a disabled button goes grey, which reads as unavailable, not as working). A
// busy submit button still submits, so the form's handler ignores a second submit itself.
// `haptic` is off by default: a tick means the tap itself made something true (a save, a logged
// set), never a navigation, an opening sheet or an action that goes on to ask a question. Android
// vibrates in `hapticStyle` (lib/use-haptic.js); iOS ticks through a HapticSwitch laid over the
// button, which needs a real element, so a link gets the vibration only.
export default function Button({ variant = 'primary', size, block, icon, iconRight, busy, haptic = false, hapticStyle = 'light', className, href, type, onClick, disabled, children, ...rest }) {
  oneOf('Button', 'variant', variant, VARIANTS)
  oneOf('Button', 'size', size, ['md', 'sm'])
  const withSwitch = haptic && !href
  const cls = cx('g-btn', 'g-btn-' + variant, size === 'sm' && 'g-btn-sm', block && 'g-btn-block', withSwitch && 'g-haptic', className)
  const lead = busy ? <span className="g-spin" aria-hidden="true" /> : icon && <Icon name={icon} className="g-icon" />
  const body = <>{lead}{children}{iconRight && <Icon name={iconRight} className="g-icon" />}{withSwitch && <HapticSwitch disabled={disabled || busy} />}</>
  const handleClick = e => {
    buzz(hapticStyle)
    onClick?.(e)
    // The tap lands on the overlay switch, so the button's implicit submission never runs: forward
    // it once the handler has had its say.
    if (withSwitch && type === 'submit' && !e.defaultPrevented && isHapticSwitchTarget(e.target)) e.currentTarget.form?.requestSubmit(e.currentTarget)
  }
  const click = haptic ? handleClick : onClick
  if (href) return <a href={href} className={cls} onClick={click} {...rest}>{body}</a>
  return <button type={type || 'button'} className={cls} disabled={disabled} aria-busy={busy ? 'true' : undefined} onClick={busy ? undefined : click} {...rest}>{body}</button>
}
