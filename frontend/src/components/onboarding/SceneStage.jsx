import { cx } from '../../lib/ui-kit.js'
import { useDrawIn } from '../../lib/use-draw-in.js'

// The card the Sex step's ring stands in, and its 320-unit canvas (the other scenes are the kit's
// Illustration; milestone B redraws this step). The floor draws itself in the first time it shows
// in a session (lib/use-draw-in.js) and is simply there after that; under reduced motion the card
// fades in over 120ms.
export default function SceneStage({ drawKey, viewBox, overlay, children }) {
  const draw = useDrawIn('onboarding:' + drawKey)
  return (
    <div className="ob-stage-card">
      <div className={cx('ob-art', draw)}>
        <svg viewBox={viewBox} aria-hidden="true" focusable="false">{children}</svg>
        {overlay}
      </div>
    </div>
  )
}
