import { useEffect, useRef } from 'react'
import StageFooter from '../../ds/StageFooter.jsx'
import { cx } from '../../lib/ui-kit.js'

// One onboarding screen's frame on the stage (the entry boards' step shell). A screen fills the
// slots; the frame owns the order and the spacing (the header block, the illustration slot, the
// caption, the controls, the footer), as <Page> does for the app's pages, so no screen chooses its
// own (onboarding-guards.test.jsx). The title takes focus on arrival, so a screen reader starts
// each step at its question.
//
//   title, sub, titleId   the question (30/34); `fixedHeader` holds it at two title and two
//                         subtitle lines (rule (b): the goal-to-weight run's floors then share one y)
//   lead                  what stands above the question (the inviter's initial); the header is
//                         then a column 16 apart, as the invite boards draw it
//   hero                  the invite's own landing: a 32/36 title and a taller illustration slot
//   far                   a screen with no scene of its own (offline, signed in): the header lower
//   headerExtra           a control that belongs to the question ("Why we ask")
//   stage                 the illustration slot; `stageDim` sets it back (an invite that no longer works)
//   caption               the scene's caption, a polite live region (undefined: none)
//   footer, footerNote    the call to action in the kit's StageFooter, pinned over what scrolls
//   center                the passkey result: everything centred, its mark as the stage
//   noNav                 the nav row is not shown: the header starts higher
//   skeleton              still loading: the header and the scene as placeholders, the title one
//                         line under them (the invite being opened)
export default function StepScreen({
  title, sub, titleId, fixedHeader = false, lead, hero = false, far = false, headerExtra, stage, stageDim = false,
  caption, footer, footerNote, center = false, onTap, noNav = false, skeleton = false, children,
}) {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  if (skeleton) {
    return <section className="ob-screen nonav" aria-labelledby={titleId}>
      <div className="ob-body">
        <div className="ob-skel" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="ob-skel-card" aria-hidden="true"><i /></div>
        <h1 ref={heading} id={titleId} className="ob-skel-t" tabIndex={-1}>{title}</h1>
      </div>
    </section>
  }
  const head = <>
    <h1 ref={heading} id={titleId} className={center ? 'ob-pass-t' : 'ob-ttl'} tabIndex={-1}>{title}</h1>
    {sub != null && <p className={center ? 'ob-pass-s' : 'ob-sub'}>{sub}</p>}
  </>
  if (center) {
    // onTap: a tap anywhere moves on early (it moves on by itself as well, so keys lose nothing).
    return <section className="ob-screen nonav" aria-labelledby={titleId} onClick={onTap}>
      <div className="ob-center" role="status" aria-live="polite">{stage}{head}{children}</div>
    </section>
  }
  return (
    <section className={cx('ob-screen', noNav && 'nonav')} aria-labelledby={titleId}>
      <div className="ob-body">
        <div className={cx('ob-hd', fixedHeader && 'fixed', lead && 'lead', hero && 'hero', far && 'far')}>{lead}{head}{headerExtra}</div>
        {stage && <div className={cx('ob-stage', hero && 'hero', stageDim && 'dim')}>{stage}</div>}
        {caption !== undefined && <p className="ob-cap" aria-live="polite">{caption}</p>}
        {children && <div className="ob-controls">{children}</div>}
      </div>
      {footer && <div className="ob-foot"><StageFooter sticky={false} note={footerNote}>{footer}</StageFooter></div>}
    </section>
  )
}
