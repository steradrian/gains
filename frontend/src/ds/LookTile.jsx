import { useEffect, useMemo, useRef, useState } from 'react'
import { deriveTheme } from '../lib/stage-look/color.js'
import { createRenderer } from '../lib/stage-look/renderer.js'
import { themeOf } from '../lib/themes.js'
import { haptic as buzz } from '../lib/use-haptic.js'

// One look on the Background page: a still preview of it in the current accent, its name, and a
// lit state when it is the chosen one. It is a radio; the page wraps the tiles in a radiogroup it
// names (the keyboard is lib/onboarding/use-radio-group.js, as in ds/AccentPicker).
//
// The preview is a canvas the look engine (lib/stage-look) draws at `intensity` (45% by default),
// with no calm zone, and redraws when the accent or the strength changes, on the same context.
// Classic is the CSS stage itself, so it draws no canvas, and where WebGL is missing or fails the
// tile shows the same CSS gradient, so a tile is never empty. `accent` is a lib/themes.js id.
// `tabIndex` lets the group make only the lit tile a tab stop.
const REST_PHASE = 0.12
const MAX_DPR = 2

// Every tile on the page draws through one shared WebGL context and copies the result into its own 2D
// canvas. Five contexts per visit to Background would pile up past WebKit's 16 until GC, and the oldest to
// go is the stage look's. The context is lost as soon as the last tile unmounts.
let shared = null // { canvas, renderer, users }
function acquireShared() {
  if (!shared) {
    const canvas = document.createElement('canvas')
    let renderer = null
    try { renderer = createRenderer(canvas) } catch { renderer = null }
    if (!renderer) return null
    shared = { canvas, renderer, users: 0 }
  }
  shared.users += 1
  return shared
}
function releaseShared() {
  if (!shared) return
  shared.users -= 1
  if (shared.users > 0) return
  shared.renderer.dispose()
  shared.canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext()
  shared = null
}

export default function LookTile({ look, accent, label, selected = false, intensity = 0.45, onSelect, tabIndex, haptic = true }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const flat = look === 'plain'
  const theme = useMemo(() => deriveTheme(themeOf(accent), intensity), [accent, intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (flat || !canvas) return undefined
    const gl = acquireShared()
    const ctx = gl ? canvas.getContext('2d') : null
    if (!gl || !ctx) {
      if (gl) releaseShared()
      setFailed(true)
      return undefined
    }
    rendererRef.current = { gl, ctx }
    return () => {
      rendererRef.current = null
      releaseShared()
    }
  }, [flat])

  useEffect(() => {
    const canvas = canvasRef.current
    const r = rendererRef.current
    if (flat || !canvas || !r) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round((canvas.clientWidth || 120) * dpr))
    const h = Math.max(1, Math.round((canvas.clientHeight || 160) * dpr))
    canvas.width = w
    canvas.height = h
    r.gl.canvas.width = w
    r.gl.canvas.height = h
    r.gl.renderer.draw({ look, theme, phase: REST_PHASE, calm: false, fade: false, dpr })
    r.ctx.drawImage(r.gl.canvas, 0, 0)
  }, [flat, look, theme])

  const choose = () => {
    if (haptic) buzz('selection')
    onSelect?.(look)
  }
  return (
    <button type="button" role="radio" aria-checked={selected} tabIndex={tabIndex} className="g-ltile" onClick={choose}>
      <span className="g-ltile-pv" aria-hidden="true">
        {!flat && !failed && <canvas ref={canvasRef} className="g-ltile-cv" />}
      </span>
      <span className="g-ltile-name">{label}</span>
    </button>
  )
}
