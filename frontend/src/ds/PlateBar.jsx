// The loaded bar, side on (bundle.js `PlateBar`; board W1.25 Plate loading): the bar and one stack
// of plates each side, biggest nearest the middle, drawn by their size against the biggest plate
// of the unit (25 kg, 45 lb). `plates` are the weights on one side, in loading order; `unit` only
// picks that scale. The drawing says nothing in words: `label` is what a screen reader hears
// ("80 kg: bar plus 25 and 5 each side"), written by the caller; without it the drawing is
// hidden from assistive tech. `children` is an optional caption under it.
const W = 320
const MID = W / 2
const GAP = 14       // from the middle to the first plate
const SLEEVE = 146   // how far a stack may run before the plates stop being drawn
const shape = (weight, ref) => {
  const f = Math.sqrt(Math.min(1, Math.max(0, weight) / ref))
  return { w: Math.round(8 + 16 * f), h: Math.round(24 + 72 * f) }
}

export default function PlateBar({ plates = [], unit = 'kg', label, children }) {
  const ref = unit === 'lb' ? 45 : 25
  const stack = []
  let run = GAP
  for (const weight of plates) {
    const { w, h } = shape(weight, ref)
    if (run + w > SLEEVE) break
    stack.push({ weight, w, h, at: run })
    run += w + 3
  }
  return (
    <figure className="g-plates">
      <svg width={W} height="124" viewBox={`0 0 ${W} 124`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
        <rect x="6" y="56" width="308" height="12" rx="6" className="g-plate-bar" />
        {stack.map(({ w, h, at }, i) => [1, -1].map(dir => (
          <rect key={dir + '-' + i} x={dir > 0 ? MID + at : MID - at - w} y={62 - h / 2} width={w} height={h} rx="5"
            className={i === 0 ? 'g-plate' : 'g-plate g-plate-2'} />
        )))}
      </svg>
      {children && <figcaption>{children}</figcaption>}
    </figure>
  )
}
