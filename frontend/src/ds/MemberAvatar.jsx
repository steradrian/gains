import { cx, oneOf } from '../lib/ui-kit.js'

export const MEMBER_TONES = ['white', 'mint', 'blue', 'purple', 'orange', 'green']
const SIZES = ['sm', 'md', 'lg']

/** The colour of the member who joined at `index` (0-based): a fixed cycle of the five colours, so a person keeps theirs in every screen. */
export const memberTone = index => MEMBER_TONES[1 + (Math.abs(index) % (MEMBER_TONES.length - 1))]

// A member in a circle: their initial, nothing else (Friends has no photos). `tone` is one of the
// calm per-person colours (MEMBER_TONES: no red, nobody is "the red one"); `white` is the stage's
// own glass. It is decoration unless the caller names it with `label` (the member's name, already
// translated), because the name is usually written beside it.
export default function MemberAvatar({ initial, size = 'md', tone = 'white', label }) {
  oneOf('MemberAvatar', 'size', size, SIZES)
  oneOf('MemberAvatar', 'tone', tone, MEMBER_TONES)
  const letter = String(initial || '').trim().charAt(0).toUpperCase()
  return (
    <span className={cx('g-mavatar', 'g-mavatar-' + size, 'g-mtone-' + tone)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' })}>
      {letter}
    </span>
  )
}
