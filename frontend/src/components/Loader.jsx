import { useEffect, useRef } from 'react'
import { createLoader } from '../lib/brand-motion.js'
import { reducedMotion } from '../lib/reduced-motion.js'
import { t } from '../lib/i18n.js'

const SIZES = ['xs', 'sm', 'md', 'lg']

// The Gains G drawing itself, over and over: the app's one loading animation. It is drawn in the
// text colour around it (the canvas reads its CSS `color` every frame), so it is muted in a muted
// line, light on the dark theme and dark on the light, and white inside a primary button. Still,
// the whole G, when the device or the app asks for reduced motion. Decoration: the words next to
// it (Loading) are what is announced.
export function Loader({ size = 'md', className }) {
  if (import.meta.env.DEV && !SIZES.includes(size)) throw new Error(`Loader: size ${size} is not one of ${SIZES.join(', ')}`)
  const ref = useRef(null)
  useEffect(() => {
    const loader = createLoader(ref.current, { reduced: reducedMotion() })
    return () => loader.destroy()
  }, [])
  return <canvas ref={ref} className={`loader loader-${size}` + (className ? ' ' + className : '')} aria-hidden="true" />
}

// A loading line: the loader and its words, one live status. `inline` sits in a sentence, a row's
// subtitle or a button, `block` (the default) is a line of its own, centred. Give children for the
// words ("Loading…" is the default); an icon-only use says so with `label`.
export function Loading({ size, inline = false, className, label, children }) {
  const words = children === undefined ? t('Loading…') : children
  return (
    <div className={'loadline' + (inline ? ' loadline-inline' : '') + (className ? ' ' + className : '')} role="status"
      aria-label={words === null || words === false ? (label || t('Loading…')) : undefined}>
      <Loader size={size || (inline ? 'xs' : 'sm')} />
      {words !== null && words !== false && <span>{words}</span>}
    </div>
  )
}
