// A single hero ring on the stage (bundle.js `StageRing`): `value` of `max` in white, three lines
// inside (`top`, the number `big`, `unit`). `over` (0-1, how far past the target as a share of
// it) adds an amber arc on top of the closed ring; amber is the whole message, so there is no red
// and no warning copy. Both arcs draw in on mount (ds.css; reduced motion shows them drawn).
// The number steps down once past four digits so it never touches the track. `loading` draws the
// skeleton the boards show (T11Loading): the track and two blobs.
export default function StageRing({ value = 0, max = 1, over = 0, top, big, unit, size = 240, stroke = 16, loading }) {
  // 8px of air outside the stroke: r=104 at the default size, as the boards draw it (the bundle's -4 gives 108)
  const r = (size - stroke) / 2 - 8
  const C = 2 * Math.PI * r
  const c = size / 2
  const bigText = String(big ?? '')
  const crowded = (bigText.match(/\d/g) || []).length > 4
  const fs = Math.round(size * (crowded ? 44 : 56) / 240)
  const arc = (frac, cls) => {
    const off = (C * (1 - frac)).toFixed(1)
    return <circle className={cls} cx={c} cy={c} r={r} strokeWidth={stroke} strokeDasharray={C.toFixed(1)} style={{ '--full': C.toFixed(1), '--to': off, strokeDashoffset: off }} />
  }
  const filled = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <span
      className="g-sring"
      style={{ width: size, height: size }}
      role={loading ? undefined : 'img'}
      aria-label={loading ? undefined : [top, bigText, unit].filter(Boolean).join(' ')}
      aria-hidden={loading ? 'true' : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="g-sring-track" cx={c} cy={c} r={r} strokeWidth={stroke} />
        {!loading && filled > 0 && arc(filled, 'g-sring-val')}
        {!loading && over > 0 && arc(Math.min(over, 1), 'g-sring-over')}
      </svg>
      <span className="g-sring-in">
        {loading
          ? <><i className="g-skel g-sring-sk-n" /><i className="g-skel g-sring-sk-l" /></>
          : <>
            {top && <span className="g-sring-top">{top}</span>}
            <b style={size !== 240 || crowded ? { fontSize: fs, lineHeight: fs + 4 + 'px' } : undefined}>{bigText}</b>
            {unit && <span className="g-sring-top">{unit}</span>}
          </>}
      </span>
    </span>
  )
}
