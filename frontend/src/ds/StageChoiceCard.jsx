import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// One answer to an onboarding question: glass, or white once `selected` so it reads from arm's
// length. `slim` for a list of short answers. A link with `href`, a button with `onClick`, which
// says whether it is the chosen answer (aria-pressed) as well as showing it.
export default function StageChoiceCard({ icon, title, sub, selected, slim, href, onClick }) {
  return (
    <Act href={href} onClick={onClick} pressed={href ? undefined : !!selected} className={cx('g-ccard', selected ? 'on' : 'g-glass', slim && 'g-ccard-slim')}>
      {icon && <span className="g-ccard-ic"><Icon name={icon} className="g-icon" /></span>}
      <span className="g-ccard-b"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <span className="g-ccard-mark" aria-hidden="true">{selected && <Icon name="check" className="g-icon" />}</span>
    </Act>
  )
}
