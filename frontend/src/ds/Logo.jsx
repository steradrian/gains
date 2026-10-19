import BrandMark from '../components/BrandMark.jsx'
import { cx, oneOf } from '../lib/ui-kit.js'
import { WORDMARK } from './wordmark.js'

const [, , WORD_W, WORD_H] = WORDMARK.viewBox.split(' ').map(Number)
// The design system's mark fills a 100-unit square; the G in it is 56.4 units across, which is
// the box BrandMark draws (lib/brand-mark.js MARK.box).
const MARK_SHARE = 0.564

// The Gains logo in the current text colour (`color` overrides it): `mark`, `wordmark` or the two
// as a `lockup`, `size` px tall. The mark is the app's own (components/BrandMark.jsx), the
// wordmark the design system's outlines. Never tinted with the accent. "Gains" is its name in
// every language.
export default function Logo({ variant = 'lockup', size = 32, color, className }) {
  oneOf('Logo', 'variant', variant, ['lockup', 'mark', 'wordmark'])
  const mark = (
    <span className="g-logo-mark" style={{ width: size, height: size, fontSize: size * MARK_SHARE }}>
      <BrandMark />
    </span>
  )
  const wordH = size * 1.05
  const word = (
    <svg viewBox={WORDMARK.viewBox} width={wordH * WORD_W / WORD_H} height={wordH} aria-hidden="true" focusable="false">
      {WORDMARK.paths.map((p, i) => <path key={i} transform={p.t} d={p.d} />)}
    </svg>
  )
  return (
    <span className={cx('g-logo', className)} role="img" aria-label="Gains" style={color ? { color } : undefined}>
      {variant !== 'wordmark' && mark}
      {variant !== 'mark' && word}
    </span>
  )
}
