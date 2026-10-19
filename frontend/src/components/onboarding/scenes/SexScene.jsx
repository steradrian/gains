import TargetRing from '../TargetRing.jsx'
import ThreadFloor from '../ThreadFloor.jsx'

// 3a Sex (board O2.4): no drawing (no figures). The live target's glass row stands in the
// illustration slot, over a floor where Goal's is (the same 300-wide canvas, the stage's floor at
// 32% white, 1.5), so the thread holds still from Goal and has a line to land on.
export default function SexScene({ target, say }) {
  return (
    <div className="ob-sex">
      <div className="g-ill g-ill-stage ob-ill-sex">
        <svg viewBox="0 0 320 144" aria-hidden="true" focusable="false"><ThreadFloor y={128} /></svg>
      </div>
      <div className="ob-sex-tgt"><TargetRing target={target} say={say} /></div>
    </div>
  )
}
