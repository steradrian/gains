import { useEffect, useMemo, useRef, useState } from 'react'
import { themeOf } from '../lib/themes.js'
import { deriveTheme } from '../lib/stage-look/color.js'
import { cancelFrame, publishPhase, requestFrame, REST_PHASE } from '../lib/stage-look/clock.js'
import { createRenderer } from '../lib/stage-look/renderer.js'

// The look drawn behind the app's pages (AppStage). Classic is the CSS stage StageArt paints, so it
// renders nothing; the other looks are one WebGL canvas. A still frame at the resting phase unless
// `motion` is on and the page is not `pushed`; then a slow loop, about 30 fps, stopped while the
// document is hidden. The loop runs on the shared frame clock (clock.js), so the glass engine rides
// the same rAF. No WebGL leaves no canvas and Classic shows; a lost context hides it until
// the browser restores the context, then the renderer is rebuilt and the look comes back.
const LOOP_MS = 40000
const FRAME_MS = 33
const MAX_DPR = 2

/**
 * @param {{ look: string, intensity: number, pushed?: boolean, motion?: boolean, accent: string }} props
 * `pushed`: inner pages and the workout draw at half strength with no calm zone and never move.
 */
export default function StageLook({ look, intensity, pushed = false, motion = false, accent }) {
  if (!look || look === 'plain') return null
  return <LookCanvas look={look} intensity={intensity} pushed={pushed} motion={motion} accent={accent} />
}

function LookCanvas({ look, intensity, pushed, motion, accent }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  // 'ok' draws; 'lost' is a context the browser took away (iOS does when the app is backgrounded
  // or short of memory) and may give back: the canvas stays, hidden, so Classic shows meanwhile;
  // 'none' is no WebGL at all (or a shader that will not compile), which no event fixes.
  const [status, setStatus] = useState('ok')
  const strength = pushed ? intensity * 0.5 : intensity
  const theme = useMemo(() => deriveTheme(themeOf(accent), strength), [accent, strength])
  const frameRef = useRef(null)

  // The renderer lives as long as the canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    const build = () => { try { return createRenderer(canvas) } catch { return null } }
    let renderer = build()
    if (!renderer) { setStatus('none'); return undefined }
    rendererRef.current = renderer
    const onLost = e => {
      e.preventDefault()   // without it the browser never restores the context
      rendererRef.current = null
      setStatus('lost')
    }
    // The old renderer's buffers and programs died with the context: a new one is built on it.
    const onRestored = () => {
      renderer.dispose()
      renderer = build()   // null when WebGL is gone for good: the cleanup copes
      if (!renderer) { setStatus('none'); return }
      rendererRef.current = renderer
      setStatus('ok')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      rendererRef.current = null
      renderer?.dispose()
    }
  }, [])

  // Draws for the current props, once, or as a loop.
  useEffect(() => {
    if (status !== 'ok') { frameRef.current = null; return undefined }
    const canvas = canvasRef.current
    const draw = phase => {
      const renderer = rendererRef.current
      if (!renderer) return
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round((canvas.clientWidth || window.innerWidth) * dpr))
      const h = Math.max(1, Math.round((canvas.clientHeight || window.innerHeight) * dpr))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      renderer.draw({ look, theme, phase, calm: !pushed, dpr })
      publishPhase(phase)
    }
    draw(REST_PHASE)
    if (!motion || pushed) {
      frameRef.current = () => draw(REST_PHASE)
      return undefined
    }
    frameRef.current = null

    let raf = 0
    let last = 0
    const start = performance.now()
    const frame = now => {
      raf = requestFrame(frame)
      if (now - last < FRAME_MS) return
      last = now
      draw((REST_PHASE + (now - start) / LOOP_MS) % 1)
    }
    const run = () => { if (!raf) raf = requestFrame(frame) }
    const stop = () => {
      if (raf) cancelFrame(raf)
      raf = 0
    }
    const onVisibility = () => { if (document.hidden) stop(); else run() }
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) run()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [look, theme, pushed, motion, status])

  // A resized or rotated screen redraws the still frame; the loop redraws by itself.
  useEffect(() => {
    const canvas = canvasRef.current
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => frameRef.current?.())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  if (status === 'none') return null
  return <canvas ref={canvasRef} className="g-stage-look" aria-hidden="true" hidden={status === 'lost'} />
}
