import { useRef } from 'react'
import { useThreadAnchor } from '../../lib/onboarding/use-thread-anchor.js'

// A bare floor (`M16 {y} H304`, the kit's il-floor, so it rests as the stage draws floors),
// registered as the screen's thread anchor, for a step with no scene of its own (Sex).
export default function ThreadFloor({ y }) {
  const ref = useRef(null)
  useThreadAnchor(ref, 'line')
  return <path ref={ref} className="il-floor" d={`M16 ${y} H304`} />
}
