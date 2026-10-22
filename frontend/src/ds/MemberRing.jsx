import { cx } from '../lib/ui-kit.js'
import { MEMBER_TONES } from './MemberAvatar.jsx'

const GAP = 6

// One ring for a group's week (boards Fr1Groups, Fr2Group): a segment per member, in the order
// they joined, each filling by that member's own `value` of `of` with the member's `tone`
// (MemberAvatar's calm colours, never red). Nobody is first or last: segments are never sorted,
// sized or coloured by how much was done, and a member with no plan has an empty segment, not a
// warning one. The ring is one image: `label` is its spoken summary, already translated, because
// numbers alone say nothing to a screen reader. `children` is the centre ("17 of 22 sessions").
// With one segment it is a plain ring; with none, only the track.
export default function MemberRing({ segments = [], size = 240, stroke = 16, label, children }) {
  const n = segments.length
  const r = (size - stroke) / 2 - 8
  const C = 2 * Math.PI * r
  const c = size / 2
  const gap = n > 1 ? GAP : 0
  const span = n ? (C - gap * n) / n : C
  const arc = (key, length, start, cls) => (
    <circle key={key} className={cls} cx={c} cy={c} r={r} strokeWidth={stroke} fill="none"
      strokeDasharray={`${length.toFixed(2)} ${(C - length).toFixed(2)}`} strokeDashoffset={(-start).toFixed(2)} />
  )
  return (
    <span className="g-mring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label || undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {n === 0 && arc('track', C, 0, 'g-mring-track')}
        {segments.map((seg, i) => {
          const start = i * (span + gap)
          const share = seg.of > 0 ? Math.max(0, Math.min(1, seg.value / seg.of)) : 0
          const tone = MEMBER_TONES.includes(seg.tone) ? seg.tone : 'glass'
          return (
            <g key={i} className={cx('g-mtone-' + tone)}>
              {arc('t' + i, span, start, 'g-mring-track')}
              {share > 0 && arc('v' + i, span * share, start, 'g-mring-val')}
            </g>
          )
        })}
      </svg>
      {children && <span className="g-mring-in">{children}</span>}
    </span>
  )
}
