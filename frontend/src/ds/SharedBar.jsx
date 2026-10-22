import { cx } from '../lib/ui-kit.js'
import { MEMBER_TONES } from './MemberAvatar.jsx'

// One bar a group fills together (board Fr3Challenge): a segment per person in the order they
// joined, each as long as that person's own `value` of the `goal`, in the person's `tone` (the same
// calm colours as MemberAvatar and MemberRing, never red). Nobody is first or last: segments are
// never sorted or sized by who did more, and a person with nothing yet simply has no segment.
// Past the goal the bar is full and the segments share it; it never says "over". The fill grows in
// on show and as work is counted, and stands still under reduced motion (ds.css).
// The bar is one image: `label` is its spoken summary, already translated; without it the
// segments' own `label`s (already translated, "Mara: 3") are read in order.
export default function SharedBar({ segments = [], goal = 0, label }) {
  const sum = segments.reduce((n, s) => n + Math.max(0, Number(s.value) || 0), 0)
  const whole = Math.max(Number(goal) || 0, sum)
  const spoken = label || segments.map(s => s.label).filter(Boolean).join(', ') || undefined
  return (
    <span className="g-sbar" role={spoken ? 'img' : undefined} aria-label={spoken}>
      <span className="g-sbar-fill" aria-hidden="true">
        {whole > 0 && segments.map((s, i) => {
          const value = Math.max(0, Number(s.value) || 0)
          if (!value) return null
          const tone = MEMBER_TONES.includes(s.tone) ? s.tone : 'white'
          return <i key={i} className={cx('g-sbar-seg', 'g-mtone-' + tone)} style={{ flexBasis: (value / whole * 100).toFixed(2) + '%' }} />
        })}
      </span>
    </span>
  )
}
