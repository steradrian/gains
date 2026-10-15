import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { systemReducesMotion } from '../lib/reduced-motion.js'
import { loadGlyphs, createSplash } from '../lib/brand-splash.js'
import { BootMark } from './BrandMark.jsx'

// How long the splash takes to leave once it may: the fade (.boot-splash in ui-kit.css) and a margin.
// A timer, not transitionend: where transitions are switched off the event never comes.
export const LEAVE_MS = 320

// Once per page load: a launch, a reload, the installed app opened from the home screen. Not when
// the app comes back from the background or a route changes, because the page is still the same page.
let started = false
export const resetBootSplash = () => { started = false }   // for tests

function canDraw() {
  try { return !!document.createElement('canvas').getContext?.('2d') } catch { return false }
}

// The splash the app opens with: over the page, hiding it while it loads, drawn by lib/brand-splash.js
// from the G the first frame already shows (index.html, the native launch image), so the G stays
// where it is and "gains" arrives under it. It ends when the animation has finished AND the app has
// read its state, then fades; a tap, Enter, Space or Escape ends it early (it still waits for the
// state). Skipped altogether for reduced motion (the device's setting or the app's switch), and where
// there is no canvas.
export default function BootSplash() {
  const ready = useStore(s => s.ready)
  const [phase, setPhase] = useState(() =>
    !started && canDraw() && !systemReducesMotion() && useStore.getState().S?.reduceMotion !== true ? 'play' : 'off')
  const [over, setOver] = useState(false)   // the animation is over, or was skipped
  const box = useRef(null), canvas = useRef(null)

  useEffect(() => { started = true }, [])

  useEffect(() => {
    if (phase !== 'play') return
    let cancelled = false, splash = null
    loadGlyphs().then(glyphs => {
      if (cancelled) return
      splash = createSplash(canvas.current, glyphs, { fromG: true, onComplete: () => setOver(true) })
      // The canvas has drawn its first frame by now: only then does the still G under it go.
      if (splash.ok) box.current.dataset.drawing = ''
      else setPhase('off')
    }).catch(() => { if (!cancelled) setPhase('off') })
    return () => { cancelled = true; splash?.destroy() }
  }, [phase === 'play'])

  useEffect(() => {
    if (phase !== 'play') return
    const key = e => { if (['Escape', 'Enter', ' '].includes(e.key)) setOver(true) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [phase === 'play'])

  useEffect(() => {
    if (phase === 'play' && over && ready) setPhase('leaving')
  }, [phase, over, ready])

  useEffect(() => {
    if (phase !== 'leaving') return
    const timer = setTimeout(() => setPhase('off'), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'off') return null
  return (
    <div ref={box} className={'boot-splash' + (phase === 'leaving' ? ' leaving' : '')} aria-hidden="true" onClick={() => setOver(true)}>
      <BootMark />
      <canvas ref={canvas} className="boot-splash-canvas" />
    </div>
  )
}
