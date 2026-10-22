import { lookUniformValues } from '../../lib/stage-look/renderer.js'
import { createGlassGL } from './glass-gl.js'
import { isChrome, KIND } from './glass-kinds.js'

// Liquid glass, the fixed presenter: two canvases that stay put while the page scrolls under them.
//   under: fixed, full viewport, above the stage and below the page content, for the glass that scrolls
//     with the page. Each shape carries its clip rect, so a rail or a sliding route layer cuts it.
//   over: a strip above the page content and below the tab bar's glyphs, for the floating chrome (the
//     bar, its lit-tab lens and its +). Its top is the highest chrome shape minus a margin and its bottom
//     the viewport's, so it costs about 1 MB instead of a full-screen buffer; it is positioned with `top`
//     and resized only when that extent changes. It bends the stage and the under-canvas panes, so a card
//     passing under the bar kinks at its rim; the bar's clear middle shows the real content through a
//     light backdrop blur laid under the canvas.
// In-flow glass scrolls on the main thread, so on iOS its shapes can trail the page by a frame; the
// transparent middle keeps that to the rim (plan 2.3).

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
 *   draw(shapes: object[], material: object, look: object): boolean, dispose(): void }}
 * `mount` is false when WebGL is not usable here. `draw` takes this frame's shapes (centre, half size, radius,
 * press, touch, opacity, clip, kind), the material (glass-gl.js DEFAULT_MATERIAL's shape) and the look inputs
 * for lib/stage-look/renderer.js lookUniformValues (without the size); it is true when it drew.
 */
export function createFixedPresenter() {
  let underLayer = null
  let overLayer = null
  let underCanvas = null
  let overCanvas = null
  let frostHost = null
  let glUnder = null
  let glOver = null
  let hooks = {}
  let prevUnder = ''
  let prevOver = ''
  let extent = ''
  const frosts = []
  const lost = new Set()
  const cleanups = []

  function build() {
    glUnder = createGlassGL(underCanvas)
    glOver = glUnder && createGlassGL(overCanvas)
    if (!glOver) {
      glUnder?.destroy()
      glUnder = glOver = null
      return false
    }
    prevUnder = prevOver = ''
    return true
  }

  function mount(host, h = {}) {
    hooks = h
    const make = (cls, ...kids) => {
      const el = document.createElement('div')
      el.className = `gl-layer ${cls}`
      el.setAttribute('aria-hidden', 'true')
      el.append(...kids)
      return el
    }
    underCanvas = document.createElement('canvas')
    overCanvas = document.createElement('canvas')
    frostHost = document.createElement('div')
    underLayer = make('gl-layer-under', underCanvas)
    overLayer = make('gl-layer-over', frostHost, overCanvas)
    host.append(underLayer, overLayer)
    if (!build()) {
      underLayer.remove()
      overLayer.remove()
      return false
    }
    for (const canvas of [underCanvas, overCanvas]) {
      const onLost = e => {
        e.preventDefault() // without it the browser never restores the context
        lost.add(canvas)
        glUnder = glOver = null
        hooks.onLost?.()
      }
      const onRestored = () => {
        lost.delete(canvas)
        if (lost.size === 0 && build()) hooks.onRestored?.()
      }
      canvas.addEventListener('webglcontextlost', onLost)
      canvas.addEventListener('webglcontextrestored', onRestored)
      cleanups.push(() => {
        canvas.removeEventListener('webglcontextlost', onLost)
        canvas.removeEventListener('webglcontextrestored', onRestored)
      })
    }
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

  function draw(shapes, material, look) {
    if (!glUnder || !glOver) return false
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const lookDpr = Math.min(dpr, LOOK_MAX_DPR)
    const lv = lookUniformValues({ ...look, w: Math.round(vw * lookDpr), h: Math.round(vh * lookDpr), dpr: lookDpr })
    const under = []
    const over = []
    for (const s of shapes) (isChrome(s.kind) ? over : under).push(glShape(s))

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

    const base = `${vw}|${vh}|${dpr}|${lookKey(lv)}|${JSON.stringify(material)}|`
    const kUnder = base + keyOf(under)
    const panes = under.filter(s => s.y + s.hh > top).slice(0, MAX_PANES)
    const kOver = `${base}${keyOf(panes)}#${keyOf(over)}#${extent}`
    let drew = false
    if (kUnder !== prevUnder) {
      prevUnder = kUnder
      glUnder.draw({ width: vw, height: vh, dpr, look: lv, material, shapes: under })
      drew = true
    }
    if (kOver !== prevOver) {
      prevOver = kOver
      // With no chrome the strip is hidden: clear it at 1 x 1 so it holds no buffer.
      const empty = over.length === 0
      glOver.draw({ width: empty ? 1 : vw, height: empty ? 1 : height, dpr, origin: [0, top], stage: [vw, vh], look: lv, material, shapes: over, panes })
      drew = true
    }
    return drew
  }

  function dispose() {
    cleanups.forEach(fn => fn())
    cleanups.length = 0
    glUnder?.destroy()
    glOver?.destroy()
    glUnder = glOver = null
    underLayer?.remove()
    overLayer?.remove()
    frosts.length = 0
  }

  return { mount, draw, dispose }
}
