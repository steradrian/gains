import { useRef } from 'react'
import Illustration from '../../ds/Illustration.jsx'
import { useThreadAnchor } from '../../lib/onboarding/use-thread-anchor.js'

// A scene on an onboarding screen: the kit's Illustration in white, drawn in the first time it
// shows in a session, with one of its paths registered as the screen's thread anchor
// (motion-onboarding-thread.md §4): `anchor` names the path (Illustration), `form` is what the
// thread becomes on it, `birth` draws the invite's line out of a dot. The rest is Illustration's
// (a scene's moving parts).
export default function StageArt({ name, anchor = 'floor', form = 'line', birth = false, width, className, style, overlay, children }) {
  const ref = useRef(null)
  useThreadAnchor(ref, form, { birth })
  return (
    <Illustration name={name} tone="stage" draw="once" width={width} className={className} style={style}
      anchor={anchor} anchorRef={ref} overlay={overlay}>{children}</Illustration>
  )
}
