// The "it worked" mark on the stage: a glass disc with a tick, and a ring that draws itself round
// it once as the screen arrives (switched off under reduced motion, ds.css, and then it is simply
// there). Decoration: the screen's heading says what happened. `tickRef` is the tick, which says
// its three points (data-pts) for whatever lands on it: the onboarding's thread bends into it.
export default function SuccessCheck({ size = 96, tickRef }) {
  return (
    <svg className="g-check" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="48" className="g-check-disc" />
      <circle className="g-check-ring" cx="48" cy="48" r="46" transform="rotate(-90 48 48)" />
      <path ref={tickRef} className="g-check-tick" data-pts="31 49.5 43 61 66 37" d="M31 49.5 43 61 66 37" />
    </svg>
  )
}
