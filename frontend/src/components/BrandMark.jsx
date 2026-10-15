import { useId } from 'react'
import { MARK } from '../lib/brand-mark.js'

export { MARK }

// The Gains G, drawn as strokes in the current text colour: a ring that turns into the crossbar,
// with a thin groove cut along the outside of it (the rim of a plate). The numbers are
// lib/brand-mark.js's; the loader and the splash draw the same G over time, and index.html carries a
// copy of this markup for the first frame, before any script runs.

// Sized by the font-size it sits in (1em), coloured by `color`. A mark that stands for the app
// has no name of its own: give `label` when it is the only thing saying so.
export default function BrandMark({ className, label }) {
  const id = 'groove-' + useId().replace(/:/g, '')
  return (
    <svg className={'brand-mark' + (className ? ' ' + className : '')} viewBox={MARK.box} width="1em" height="1em"
      role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect className="mark-keep" width="100" height="100" />
          <path className="mark-cut" d={MARK.groove} fill="none" strokeWidth={MARK.grooveWidth} strokeLinejoin="round" />
        </mask>
      </defs>
      <path mask={`url(#${id})`} d={MARK.centre} fill="none" stroke="currentColor" strokeWidth={MARK.width} strokeMiterlimit="4" />
    </svg>
  )
}

// The first frame of the app, until the state is read: the mark where the splash holds it.
export function BootMark() {
  return <div className="boot-mark"><BrandMark /></div>
}
