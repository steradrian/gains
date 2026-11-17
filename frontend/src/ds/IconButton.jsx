import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

// A 36px disc inside a 44px hit area. `label` is its name and says the outcome ("Add to Lunch",
// not "Plus"). `tone`: none (back, a card's ⋯), tonal (a sheet's close, steppers), accent (the one
// quick action in a row), glass (on the stage).
export default function IconButton({ icon, label, tone, className, ...rest }) {
  oneOf('IconButton', 'tone', tone, ['tonal', 'accent', 'glass'])
  return (
    <button type="button" {...rest} aria-label={label} className={cx('g-iconbtn', tone && 'g-iconbtn-' + tone, className)}>
      <span className={tone === 'glass' ? 'g-glass' : undefined} data-glass={tone === 'glass' ? 'control' : undefined}><Icon name={icon} className="g-icon" /></span>
    </button>
  )
}
