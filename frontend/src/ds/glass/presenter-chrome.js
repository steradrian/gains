import { lookUniformValues } from '../../lib/stage-look/renderer.js'
import { acquireGlassGL, createGlassGL, releaseGlassGL } from './glass-gl.js'
import { KIND } from './glass-kinds.js'

// Liquid glass, the chrome presenter: one canvas that stays put while the page scrolls under it, for the
// floating chrome (the tab bar, its lit-tab lens and its +, the workout footer, the live dock). It is a
// strip above the page content and below the tab bar's glyphs: its top is the highest chrome shape minus
// a margin and its bottom the viewport's, so it costs about 1 MB instead of a full-screen buffer; it is
// positioned with `top` and resized only when that extent changes. It bends the stage and the in-flow
// panes passed to `draw` (the sprite presenter draws those; here they are only what the chrome bends), so a
// card passing under the bar kinks at its rim; the bar's clear middle shows the real content through a
// light backdrop blur laid under the canvas.

const BAR_CENTRE_ALPHA = 0.5
const STRIP_MARGIN = 40
const MAX_DPR = 3
const LOOK_MAX_DPR = 2 // StageLook's own cap: the look's line widths and thread density depend on it
const MAX_PANES = 12

const keyOf = shapes => shapes.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.hw.toFixed(2)},${s.hh.toFixed(2)},${s.radius.toFixed(1)},${s.press.toFixed(3)},${s.opacity.toFixed(3)},${s.kind},${s.touch || ''},${s.clip || ''}`).join('|')

const lookKey = v => [v.phase, v.comp, v.intensity, v.seed, v.calm, v.fade, v.grain, v.res, v.dpr, v.top, v.end, v.glow, v.art, v.accent, v.inkDir, v.decor, v.decorC].join(',')

const glShape = s => ({ ...s, centreA: s.kind === KIND.BAR || s.kind === KIND.LENS ? BAR_CENTRE_ALPHA : 1 })

/**
 * @returns {{ mount(host: Element, hooks?: { onLost?: () => void, onRestored?: () => void }): boolean,
 *   draw(chrome: object[], inFlow: object[], material: object, look: object): boolean, bytes(): number, dispose(): void }}
 * `mount` is false when WebGL is not usable here. `draw` takes this frame's chrome shapes and the in-flow
 * panes they bend (centre, half size, radius, press, touch, opacity, clip, kind), the material
 * (glass-gl.js DEFAULT_MATERIAL's shape) and the look inputs for lib/stage-look/renderer.js
 * lookUniformValues (without the size); it is true when it drew. `bytes` is the canvas's backing store,
 * for the dev HUD.
 */
export function createChromePresenter() {
  let overLayer = null
  let overCanvas = null
  let frostHost = null
  let glOver = null
  let hooks = {}
  let prevOver = ''
  let extent = ''
  const frosts = []
  const cleanups = []

  // After a loss and its restore: a new renderer on the same canvas.
  function rebuild() {
    glOver = createGlassGL(overCanvas)
    prevOver = ''
    return !!glOver
  }

  function mount(host, h = {}) {
    hooks = h
    // Pooled renderers (glass-gl.js): a rebuild of the engine must not make new WebGL contexts.
    glOver = acquireGlassGL()
    if (!glOver) return false
    overCanvas = glOver.canvas
    frostHost = document.createElement('div')
    overLayer = document.createElement('div')
    overLayer.className = 'gl-layer gl-layer-over'
    overLayer.setAttribute('aria-hidden', 'true')
    overLayer.append(frostHost, overCanvas)
    host.append(overLayer)
    const onLost = e => {
      e.preventDefault() // without it the browser never restores the context
      glOver = null
      hooks.onLost?.()
    }
    const onRestored = () => {
      if (rebuild()) hooks.onRestored?.()
    }
    overCanvas.addEventListener('webglcontextlost', onLost)
    overCanvas.addEventListener('webglcontextrestored', onRestored)
    cleanups.push(() => {
      overCanvas.removeEventListener('webglcontextlost', onLost)
      overCanvas.removeEventListener('webglcontextrestored', onRestored)
    })
    return true
  }

  function layFrost(bars, top) {
    while (frosts.length < bars.length) {
      const f = document.createElement('div')
      f.className = 'gl-frost'
      frostHost.appendChild(f)
      frosts.push(f)
    }
    frosts.forEach((f, i) => {
      const b = bars[i]
      f.style.display = b ? '' : 'none'
      if (!b) return
      f.style.width = `${b.hw * 2}px`
      f.style.height = `${b.hh * 2}px`
      f.style.borderRadius = `${b.radius}px`
      f.style.transform = `translate3d(${b.x - b.hw}px, ${b.y - b.hh - top}px, 0)`
    })
  }

  function draw(chrome, inFlow, material, look) {
    if (!glOver) return false
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const lookDpr = Math.min(dpr, LOOK_MAX_DPR)
    const lv = lookUniformValues({ ...look, w: Math.round(vw * lookDpr), h: Math.round(vh * lookDpr), dpr: lookDpr })
    const over = chrome.map(glShape)

    let top = 0
    let height = vh
    if (over.length) {
      top = Math.max(0, Math.floor(Math.min(...over.map(s => s.y - s.hh)) - STRIP_MARGIN))
      height = Math.max(1, vh - top)
    }
    const nextExtent = over.length ? `${top}|${height}` : 'none'
    if (nextExtent !== extent) {
      extent = nextExtent
      overLayer.style.display = over.length ? '' : 'none'
      if (over.length) {
        overLayer.style.top = `${top}px`
        overLayer.style.height = `${height}px`
      }
    }
    layFrost(over.filter(s => s.kind === KIND.BAR), top)

    const panes = inFlow.map(glShape).filter(s => s.y + s.hh > top).slice(0, MAX_PANES)
    const kOver = `${vw}|${vh}|${dpr}|${lookKey(lv)}|${JSON.stringify(material)}|${keyOf(panes)}#${keyOf(over)}#${extent}`
    if (kOver === prevOver) return false
    prevOver = kOver
    // With no chrome the strip is hidden: clear it at 1 x 1 so it holds no buffer.
    const empty = over.length === 0
    glOver.draw({ width: empty ? 1 : vw, height: empty ? 1 : height, dpr, origin: [0, top], stage: [vw, vh], look: lv, material, shapes: over, panes })
    return true
  }

  function dispose() {
    cleanups.forEach(fn => fn())
    cleanups.length = 0
    releaseGlassGL(glOver)
    glOver = null
    overLayer?.remove()
    frosts.length = 0
  }

  const bytes = () => (overCanvas ? overCanvas.width * overCanvas.height * 4 : 0)

  return { mount, draw, bytes, dispose }
}
