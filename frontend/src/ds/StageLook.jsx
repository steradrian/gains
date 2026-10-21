import { useEffect, useMemo, useRef, useState } from 'react'
import { themeOf } from '../lib/themes.js'
import { deriveTheme } from '../lib/stage-look/color.js'
import { createRenderer } from '../lib/stage-look/renderer.js'

// The look drawn behind the app's pages (AppStage). Classic is the CSS stage StageArt paints, so it
// renders nothing; the other looks are one WebGL canvas. A still frame at the resting phase unless
// `motion` is on and the page is not `pushed`; then a slow loop, about 30 fps, stopped while the
// document is hidden. No WebGL (or a lost context) leaves no canvas and Classic shows.
const REST_PHASE = 0.12
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
  const [failed, setFailed] = useState(false)
  const strength = pushed ? intensity * 0.5 : intensity
  const theme = useMemo(() => deriveTheme(themeOf(accent), strength), [accent, strength])
  const frameRef = useRef(null)

  // The renderer lives as long as the canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    let renderer = null
    try { renderer = createRenderer(canvas) } catch { renderer = null }
    if (!renderer) { setFailed(true); return undefined }
    rendererRef.current = renderer
    const onLost = e => {
      e.preventDefault()
      rendererRef.current = null
      setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      rendererRef.current = null
      renderer.dispose()
    }
  }, [])

  // Draws for the current props, once, or as a loop.
  useEffect(() => {
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
      raf = requestAnimationFrame(frame)
      if (now - last < FRAME_MS) return
      last = now
      draw((REST_PHASE + (now - start) / LOOP_MS) % 1)
    }
    const run = () => { if (!raf) raf = requestAnimationFrame(frame) }
    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    const onVisibility = () => { if (document.hidden) stop(); else run() }
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) run()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [look, theme, pushed, motion])

  // A resized or rotated screen redraws the still frame; the loop redraws by itself.
  useEffect(() => {
    const canvas = canvasRef.current
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => frameRef.current?.())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  if (failed) return null
  return <canvas ref={canvasRef} className="g-stage-look" aria-hidden="true" />
}
