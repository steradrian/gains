import { cx } from '../../../lib/ui-kit.js'
import StageArt from '../StageArt.jsx'

// 3c Height: a door frame with a height mark on its jamb (the kit's `height` scene): 0-220 cm on
// y 128 → 20 (.49 a cm). The scene draws the mark at y 54 and the lit column from there to the
// floor (74 tall); the mark moves by transform only and the column scales with it. `live` while
// the ruler is dragged, so it follows at 120ms instead of 420.
const MARK_Y = 54
const COLUMN = 74

export default function DoorScene({ cm, live, after }) {
  const set = cm != null
  const mark = set ? { '--y': (128 - 0.49 * cm - MARK_Y).toFixed(1) + 'px', '--s': (Math.min(108, 0.49 * cm) / COLUMN).toFixed(3) } : undefined
  return <StageArt name="height" width={260} className={cx('ob-height', set && 'set', live && 'live')} style={mark} after={after} />
}
