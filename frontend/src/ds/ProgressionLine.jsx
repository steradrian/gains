import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'

const ICONS = ['arrowUp', 'lightbulb', 'arrowDown']
const TONES = ['default', 'warning']

// What progression decided for the exercise on the stage (boards W1.0, W1.47, W1.49): an icon, the
// policy in bold, " · " and the reason, in at most two lines (a longer reason ends in "…"). One
// button that opens Exercise settings. `label` is the spoken name, the whole sentence in full;
// every string is the caller's. A deload reads in the warning tone.
export default function ProgressionLine({ icon = 'lightbulb', policy, reason, label, tone = 'default', href, onClick }) {
  if (!policy || !reason) return null
  return (
    <Act href={href} onClick={onClick} ariaLabel={label} className={cx('g-prog', 'g-prog-' + oneOf('ProgressionLine', 'tone', tone, TONES))}>
      <Icon name={oneOf('ProgressionLine', 'icon', icon, ICONS)} className="g-icon" />
      <span className="g-prog-text"><b>{policy}</b>{' · '}{reason}</span>
    </Act>
  )
}
