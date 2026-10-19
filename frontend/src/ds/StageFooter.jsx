import { cx } from '../lib/ui-kit.js'

// The bottom of an onboarding or sign-in screen: the content fades into the stage, then the white
// Button (variant primary) and an optional plain link (variant ghost) or `note`. Pinned to the
// bottom of the screen unless `sticky={false}`.
export default function StageFooter({ note, sticky = true, children }) {
  return (
    <div className={cx('g-sfoot', sticky && 'g-sfoot-sticky')}>
      {note && <p>{note}</p>}
      {children}
    </div>
  )
}
