import Icon from '../components/Icon.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'

// A filter chip on the stage (boards T6.0 and T6.2: Any equipment ▾, Any type ▾, Favourites · 3). It
// is smaller than ChipGroup's pill and sits in a row of filters. `pressed` is a filter that is on
// (it lights white). A chip that only switches a filter on and off is a toggle (`aria-pressed`);
// `opens` marks one that opens a choice, with a ▾, and then it says so (`aria-haspopup`) and is
// not a toggle, since what it holds is the choice made in the drawer. `count` is an optional number
// after the label, said as part of it; the caller formats it. The visual height is 26px, and the
// tap area is padded out to 44px without moving anything.
const TONES = ['stage']

export default function Chip({ children, tone = 'stage', pressed = false, opens = false, count, onClick }) {
  oneOf('Chip', 'tone', tone, TONES)
  return (
    <button
      type="button"
      className={cx('g-fchip', 'g-fchip-' + tone, pressed && 'on')}
      aria-pressed={opens ? undefined : pressed}
      data-glass="flat"
      aria-haspopup={opens ? 'dialog' : undefined}
      onClick={onClick}
    >
      {children}
      {count != null && <span className="g-fchip-n"><span aria-hidden="true"> · </span>{count}</span>}
      {opens && <Icon name="chevronDown" className="g-icon g-fchip-caret" />}
    </button>
  )
}
