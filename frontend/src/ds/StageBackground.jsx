import { cx } from '../lib/ui-kit.js'

// The stage: accent-stage → accent-stage-end at 170°, two accent-glow radial glows and the faint
// plate rings from the logo. Children render above it in normal flow.
export default function StageBackground({ className, style, children }) {
  return (
    <div className={cx('g-stage', className)} style={style}>
      <div className="g-stage-art" aria-hidden="true">
        <span className="g-stage-glow g-stage-glow-a" />
        <span className="g-stage-glow g-stage-glow-b" />
        <svg className="g-stage-rings" width="640" height="640" viewBox="0 0 640 640">
          <circle cx="320" cy="320" r="300" strokeOpacity="0.07" strokeWidth="56" />
          <circle cx="320" cy="320" r="256" strokeOpacity="0.12" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="g-stage-body">{children}</div>
    </div>
  )
}
