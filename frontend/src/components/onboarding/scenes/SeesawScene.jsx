import { cx } from '../../../lib/ui-kit.js'
import StageArt from '../StageArt.jsx'

// 2 Goal: the energy seesaw (the kit's `goal` scene). Food on one side, training on the other; the
// goal tips it. A pure function of the goal on screen (the pressed card previews it). The plank
// carries the data: solid in the accent, dashed and muted for "not sure yet", muted with nothing
// picked; building muscle adds the outer plates. onboarding.css moves the scene's handles.
const SEESAW = {
  none: { r: 0, m: 0, plank: 'mute' },
  lose: { r: 6, m: 0.55, plank: 'acc' },
  keep: { r: 0, m: 0.8, plank: 'acc' },
  build: { r: -6, m: 1.15, plank: 'acc' },
  unsure: { r: 0, m: 0.8, plank: 'dash' },
}

export default function SeesawScene({ goal }) {
  const k = SEESAW[goal || 'none']
  return <StageArt name="goal" width={300} className={cx('ob-ill-goal', 'plank-' + k.plank, goal === 'build' && 'build')}
    style={{ '--r': k.r + 'deg', '--m': k.m }} />
}
