import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import WorkoutThumb from './WorkoutThumb.jsx'

const PLACES = ['footer', 'rest']

// A line over the workout's footer (boards W1.2, W1.7, W1.8, W1.39): "Warm-up done · 3 exercises ·
// 6 sets", "Next: Dumbbell press", "New best · Cable fly 20 kg × 12", with the exercise's picture
// or a glyph (`icon`, a check by default) and one action (Back, Trend). It is a status, so a
// screen reader hears it when it appears. It does not time itself out: the caller removes it.
//
// `placement` puts it where the workout wants it: "footer" just above the bar, "rest" above the
// bar's rest row as well; left out, it is an ordinary block for the caller to place. `actionLabel`
// left out means no action. The message is `message` or the children; every string is the caller's.
export default function BarToast({ message, image, icon = 'check', actionLabel, actionHref, onAction, placement, children }) {
  oneOf('BarToast', 'placement', placement, PLACES)
  return (
    <div className={cx('g-btoast', placement && 'g-btoast-' + placement)} role="status">
      {image ? <WorkoutThumb image={image} size="sm" /> : <span className="g-btoast-ic"><Icon name={icon} className="g-icon" /></span>}
      <span className="g-btoast-m">{message ?? children}</span>
      {actionLabel && <Act href={actionHref} onClick={onAction} className="g-btoast-a">{actionLabel}</Act>}
    </div>
  )
}
