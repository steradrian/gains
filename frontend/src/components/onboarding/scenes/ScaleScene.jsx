import { KG_LB } from '../../../lib/onboarding/units.js'
import { cx } from '../../../lib/ui-kit.js'
import StageArt from '../StageArt.jsx'

// 3d Weight: a bathroom scale from above, a tape behind a fixed accent needle (the kit's `weight`
// scene, whose tape runs 35-250 kg at 4 units a kilo with 70 under the needle). The numbers sit on
// HTML strips under the window (one strip is 1000 tape units, so a label's place is a plain %),
// kilos or pounds by the unit chip.
const KG_LABELS = [], LB_LABELS = []
for (let kg = 40; kg <= 250; kg += 10) KG_LABELS.push({ v: kg, at: (0.4 * kg).toFixed(2) })
for (let lb = 80; lb <= 540; lb += 20) LB_LABELS.push({ v: lb, at: ((0.4 * lb) / KG_LB).toFixed(2) })
const AT_REST = 70

export default function ScaleScene({ kg, unit, live }) {
  const k = kg ?? AT_REST
  const strip = { '--x': ((32 - 4 * k) / 10).toFixed(2) }
  return <StageArt name="weight" width={260} className={cx('ob-ill-weight', kg != null && 'set', live && 'live')}
    style={{ '--x': (4 * (AT_REST - k)).toFixed(1) + 'px' }}
    overlay={<div className="ob-sl-box" aria-hidden="true">
      {[['kg', KG_LABELS], ['lb', LB_LABELS]].map(([u, labels]) => (
        <div key={u} className={cx('ob-sl-strip', unit !== u && 'ob-off')} style={strip}>
          {labels.map(l => <span key={l.v} style={{ '--at': l.at }}>{l.v}</span>)}
        </div>
      ))}
    </div>} />
}
