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

export default function LookTile({ look, accent, label, selected = false, intensity = 0.45, onSelect, tabIndex, haptic = true }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const flat = look === 'plain'
  const theme = useMemo(() => deriveTheme(themeOf(accent), intensity), [accent, intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (flat || !canvas) return undefined
    let renderer = null
    try { renderer = createRenderer(canvas) } catch { renderer = null }
    if (!renderer) { setFailed(true); return undefined }
    rendererRef.current = renderer
    return () => {
      rendererRef.current = null
      renderer.dispose()
    }
  }, [flat])

  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (flat || !canvas || !renderer) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round((canvas.clientWidth || 120) * dpr))
    canvas.height = Math.max(1, Math.round((canvas.clientHeight || 160) * dpr))
    renderer.draw({ look, theme, phase: REST_PHASE, calm: false, fade: false, dpr })
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
