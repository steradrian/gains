import { deriveTheme, hexToRgb } from '../../lib/stage-look/color.js'
import { currentPhase, REST_PHASE } from '../../lib/stage-look/clock.js'
import { reducedMotion } from '../../lib/reduced-motion.js'
import { lookUniformValues } from '../../lib/stage-look/renderer.js'
import { themeOf } from '../../lib/themes.js'
import { acquireGlassGL, releaseGlassGL } from './glass-gl.js'
import { isChrome, KIND, swollen } from './glass-kinds.js'
import { createRegistry } from './glass-registry.js'
import { createScheduler } from './glass-scheduler.js'
import { createStats } from './glass-stats.js'
import { createWatchdog, glassIsOff } from './glass-watchdog.js'
import { createMaterialProbe } from './material-probe.js'
import { createFixedPresenter } from './presenter-fixed.js'
import { createSpritePresenter } from './presenter-sprite.js'

// Liquid glass engine: the registry, scheduler and presenters wired together for one ground. GlassHost.jsx
// owns its lifetime. Everything here is plain JS so the frame is easy to reason about:
//   read every rect (registry) -> step the springs -> write --lg-press -> draw (presenters).
// Chrome always draws on the fixed presenter's over strip. In-flow glass draws on its under canvas
// (presenter 'fixed') or in per-element sprites (presenter 'sprite', presenter-sprite.js); `compare`
// mounts both, for #/dev/glass's side-by-side check ([data-lg-compare="fixed" | "sprite"] picks one).

const CLASSIC_INTENSITY = 0.45 // the design's Classic stage; there is no setting for it
const CLASSIC_EASE_S = 0.1 // time constant of the ease to half on a pushed page (about 400 ms to settle)
const LENS_STRETCH_PX = 10
const FIXED_BAND = 80 // px outside the viewport the fixed presenter still draws (the registry's default)
const MAX_DPR = 3
const LOOK_MAX_DPR = 2
const RUN_GAP_MS = 250 // frames further apart than this are a new run, not a slow frame

export const PRESENTER = Object.freeze({ FIXED: 'fixed', SPRITE: 'sprite' })

/**
 * @param {{ ground: Element, host: Element, getInputs: () => { look: string, accent: string, pushed: boolean,
 *   intensity: number, motion: boolean, mode?: string, stageOnly?: boolean }, onStatus: (s: 'webgl' | 'fallback' | 'reduced') => void,
 *   include?: string, onDom?: () => void, presenter?: 'fixed' | 'sprite', sprite?: object, compare?: boolean,
 *   watchdog?: boolean }} opts
 *   `include`: the registry only takes shapes inside this selector. `onDom`: called on every DOM change under the ground.
 *   `presenter`: where in-flow glass draws. `sprite`: presenter-sprite.js options (copy, cardDpr, shadow).
 *   `watchdog: false` (the dev page) never switches the session to CSS, so slow numbers stay readable on the HUD.
 * @returns {{ wake(reason: string): void, setFrozen(flag: boolean): void, stats: object, dispose(): void } | null}
 *   null when the page keeps the CSS material. `stats` (glass-stats.js) feeds the dev HUD.
 *
 * The page never goes blank: the CSS material stays until the first frame is drawn, and 'webgl' (with the
 * data-lg-on marks that clear the CSS fill) is reported in that same frame; a sprite's element is marked in
 * the task of its own first copy. A lost context, a trip of the watchdog or a failed mount reports
 * 'fallback' at once and unmarks every shape.
 */
export function createGlassEngine({
  ground, host, getInputs, onStatus, include = '', onDom = () => {},
  presenter: mode = PRESENTER.FIXED, sprite: spriteOpts = {}, compare = false, watchdog: watch = true,
}) {
  if (window.matchMedia?.('(prefers-reduced-transparency: reduce)')?.matches) { onStatus('reduced'); return null }
  if (watch && glassIsOff()) { onStatus('fallback'); return null }
  let scheduler = null
  let registry = null
  let live = false // 'webgl' reported: the shapes are marked and the CSS fill is off
  let frozen = false // the host's pause: a sheet, the search overlay, a hidden document
  const lostFrom = new Set() // presenters whose context is gone, or 'watchdog'
  const applyPause = () => scheduler?.setPaused(frozen || lostFrom.size > 0)
  const goCss = () => {
    live = false
    registry?.setMarked(false)
    onStatus('fallback')
  }
  const lose = who => { lostFrom.add(who); applyPause(); goCss() }
  const restore = who => { lostFrom.delete(who); applyPause() }

  const stats = createStats()
  const useSprites = mode === PRESENTER.SPRITE || compare
  const useUnder = mode === PRESENTER.FIXED || compare
  const presenter = createFixedPresenter({ under: useUnder })
  const sprites = useSprites ? createSpritePresenter(spriteOpts) : null
  if (!presenter.mount(host, { onLost: () => lose('fixed'), onRestored: () => restore('fixed') })) { onStatus('fallback'); return null }
  const spritesOk = !sprites || sprites.mount({
    onReady: el => { if (live) registry?.mark(el, true) },
    onRelease: el => registry?.mark(el, false),
    onLost: () => lose('sprite'),
    onRestored: () => restore('sprite'),
    onCopy: (transferMs, latencyMs) => {
      const t = performance.now()
      stats.push('transfer', transferMs, t)
      stats.push('latency', latencyMs, t)
    },
  })
  if (!spritesOk) { presenter.dispose(); onStatus('fallback'); return null }

  // Which presenter draws an in-flow shape. The compare group an element sits in never changes, so it is cached.
  const groups = new WeakMap()
  const groupOf = el => {
    if (!compare) return null
    if (!groups.has(el)) groups.set(el, el.closest('[data-lg-compare]')?.getAttribute('data-lg-compare') || null)
    return groups.get(el)
  }
  const viaSprite = s => !!sprites && !isChrome(s.kind) && (groupOf(s.el) === PRESENTER.SPRITE || (groupOf(s.el) !== PRESENTER.FIXED && mode === PRESENTER.SPRITE))

  const probe = createMaterialProbe(host)
  const watchdog = watch ? createWatchdog({
    onTrip() {
      lose('watchdog')
      presenter.dispose()
      sprites?.dispose()
    },
  }) : null
  registry = createRegistry(ground, {
    include,
    onChange: reason => { scheduler?.wake(reason); if (reason === 'dom') onDom() },
    // A sprite's element keeps its CSS material until its sprite has content (R7).
    defer: s => viaSprite(s) && !sprites.isReady(s.el),
    nearMargin: sprites ? '100%' : '50%',
    onSpriteRemoved: (hostEl, canvas) => sprites?.restore(hostEl, canvas),
  })
  const lensMotion = new Map() // lens element -> { x, stretch }
  const themes = new Map() // accent -> theme at the base intensity
  let classic = null // Classic's eased intensity
  let materialKey = ''
  let material = null

  const stillNow = () => !getInputs().motion || reducedMotion()

  // The stage colours come from the same derivation StageLook uses, so the glass refracts what is drawn.
  const themeFor = (accent, intensity) => {
    let base = themes.get(accent)
    if (!base) { base = deriveTheme(themeOf(accent), CLASSIC_INTENSITY); themes.set(accent, base) }
    return { ...base, intensity }
  }

  // StageLook draws at half strength on a pushed page, without a jump. Classic is CSS there, with its
  // glows and rings easing over 400 ms (ds.css .g-app-stage[data-pushed]), so its intensity eases too.
  function intensityFor(inp, dt) {
    const strength = inp.pushed ? inp.intensity * 0.5 : inp.intensity
    if (inp.look !== 'plain') { classic = null; return { value: strength, easing: false } }
    const target = inp.pushed ? CLASSIC_INTENSITY * 0.5 : CLASSIC_INTENSITY
    if (classic === null || stillNow()) classic = target
    else classic += (target - classic) * (1 - Math.exp(-dt / CLASSIC_EASE_S))
    if (Math.abs(target - classic) < 0.002) classic = target
    return { value: classic, easing: classic !== target }
  }

  function materialFor(inp) {
    const mode = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    const key = `${inp.accent}|${mode}`
    if (key !== materialKey) {
      materialKey = key
      const preset = themeOf(inp.accent)
      material = { ...probe.read(inp.accent), tint: hexToRgb(mode === 'light' ? preset.fill : preset.dark.fill) }
    }
    return material
  }

  function compose(s, dt) {
    const p = scheduler.springs.get(s.el)
    let stretch = 0
    if (s.kind === KIND.LENS) {
      // Moving, the lens stretches along its path and thins a touch, like a drop.
      const m = lensMotion.get(s.el) || { x: s.x, stretch: 0 }
      const goal = stillNow() ? 0 : Math.min((Math.abs(s.x - m.x) / dt) * 0.014, LENS_STRETCH_PX)
      m.stretch += (goal - m.stretch) * Math.min(1, dt * 18)
      m.x = s.x
      lensMotion.set(s.el, m)
      stretch = m.stretch
    }
    const box = { x: s.x, y: s.y, hw: s.hw, hh: s.hh } // the element's own box; a sprite is fixed to it
    return { ...s, ...swollen(s, p.v, { reduced: stillNow(), stretch, bar: s.bar }), press: p.v, touch: p.touch, box }
  }

  let lastFrameAt = 0
  function frame(dt) {
    const t0 = performance.now()
    const changed = draw(dt)
    const t1 = performance.now()
    watchdog?.frame(changed.drew, t1 - t0, dt * 1000, t0)
    const gap = t0 - lastFrameAt
    if (lastFrameAt && gap < RUN_GAP_MS) stats.push('interval', gap, t0)
    lastFrameAt = t0
    if (changed.drew) stats.push('frame', t1 - t0, t0)
    return changed.any
  }

  // In-flow shapes the fixed presenter would draw: its own band and no faded ones, as before sprites.
  const fixedVisible = s => s.opacity >= 0.01 && s.y + s.hh > -FIXED_BAND && s.y - s.hh < window.innerHeight + FIXED_BAND

  // How far in-flow glass moved since the last frame (px): the fixed presenter's rim trails by at least this.
  const lastPos = new WeakMap()
  function movement(shapes) {
    let most = 0
    for (const s of shapes) {
      const p = lastPos.get(s.el)
      if (p) most = Math.max(most, Math.hypot(s.box.x - p.x, s.box.y - p.y))
      lastPos.set(s.el, { x: s.box.x, y: s.box.y })
    }
    return most
  }

  let stage = null // the "stage only" check: { layer, canvas, gl, key }
  const dropStage = () => {
    if (!stage) return
    releaseGlassGL(stage.gl)
    stage.layer.remove()
    stage = null
  }
  function drawStage(inp, look, material) {
    if (!inp.stageOnly) { dropStage(); return }
    if (!stage) {
      const gl = acquireGlassGL()
      if (!gl) return
      const layer = document.createElement('div')
      layer.className = 'gl-layer gl-layer-stage'
      layer.setAttribute('aria-hidden', 'true')
      layer.appendChild(gl.canvas)
      host.prepend(layer) // under the under canvas: it stands in for the real stage, nothing more
      stage = { layer, canvas: gl.canvas, gl, key: '' }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const lookDpr = Math.min(dpr, LOOK_MAX_DPR)
    const lv = lookUniformValues({ ...look, w: Math.round(vw * lookDpr), h: Math.round(vh * lookDpr), dpr: lookDpr })
    const key = `${vw}|${vh}|${dpr}|${JSON.stringify(lv)}`
    if (key === stage.key) return
    stage.key = key
    // The right half only, so the seam at the middle compares the shader's stage with the real one.
    const half = { x: vw * 0.75, y: vh / 2, hw: vw / 4, hh: vh / 2, radius: 0, press: 0, kind: KIND.CARD, centreA: 1, opacity: 1, touch: null, clip: [vw / 2, 0, vw, vh] }
    stage.gl.draw({ width: vw, height: vh, dpr, look: lv, material, shapes: [half], stageOnly: true })
  }

  function draw(dt) {
    const inp = getInputs()
    const vh = window.innerHeight
    // Sprites are made half a viewport ahead, so on iOS's async scroll a shape has its glass before it shows.
    const raw = registry.read(sprites ? { band: vh / 2, faded: true } : undefined)
    const moving = scheduler.springs.step(dt)
    const shapes = raw.map(s => compose(s, dt))
    scheduler.springs.flush()
    const { value, easing } = intensityFor(inp, dt)
    const animating = inp.look !== 'plain' && inp.motion && !inp.pushed
    const material = materialFor(inp)
    const look = {
      look: inp.look,
      theme: themeFor(inp.accent, value),
      phase: animating ? currentPhase() : REST_PHASE,
      calm: !inp.pushed,
    }
    const chrome = []
    const inFixed = []
    const inSprite = []
    for (const s of shapes) {
      if (isChrome(s.kind)) { if (s.opacity >= 0.01) chrome.push(s) } else if (viaSprite(s)) inSprite.push(s)
      else if (fixedVisible(s)) inFixed.push(s)
    }
    // Over-only (sprites, no compare): the in-flow glass is still passed, as the panes the chrome bends.
    const toFixed = useUnder ? chrome.concat(inFixed) : chrome.concat(inSprite.filter(fixedVisible))
    const t0 = performance.now()
    const drewFixed = presenter.draw(toFixed, material, look)
    const t1 = performance.now()
    const sp = sprites ? sprites.draw(inSprite, material, look, {
      lookId: `${inp.look}|${inp.accent}|${inp.pushed}|${inp.intensity}|${inp.motion}|${inp.mode}`,
      keep: el => {
        const s = registry.shapes.get(el)
        return !!s && s.near && el.isConnected && viaSprite(s)
      },
    }) : null
    drawStage(inp, look, material)
    const drew = drewFixed || !!sp?.drew
    if (drew && !live && lostFrom.size === 0) {
      live = true
      registry.setMarked(true)
      onStatus('webgl')
    }
    record(t0, t1, drewFixed, sp, chrome, inFixed, inSprite)
    return { drew, any: moving || easing || drew || !!sp?.pending }
  }

  function record(t0, t1, drewFixed, sp, chrome, inFixed, inSprite) {
    const st = sprites?.stats()
    const move = movement(inFixed.concat(inSprite))
    if (move > 0.05) stats.push('move', move, t0)
    let drawMs = drewFixed ? t1 - t0 : 0
    if (sp?.drew) {
      drawMs += st.drawMs
      stats.push('copy', st.copyMs, t0)
      stats.push('refresh', st.drawMs + st.copyMs, t0)
    }
    if (drawMs > 0) stats.push('draw', drawMs, t0)
    if (st && st.contentLag > 0.05) stats.push('contentLag', st.contentLag, t0)
    stats.set('presenter', mode)
    stats.set('compare', compare)
    stats.set('chrome', chrome.length)
    stats.set('inFixed', inFixed.length)
    stats.set('inSprite', inSprite.length)
    stats.set('bytes', presenter.bytes() + (sprites?.bytes() || 0) + (stage ? stage.canvas.width * stage.canvas.height * 4 : 0))
    if (st) {
      stats.set('sprites', st.sprites)
      stats.set('refreshed', st.refreshed)
      stats.set('atlas', `${st.atlasW}x${st.atlasH}`)
      stats.set('pages', st.pages)
      stats.set('skipped', st.skipped)
      stats.set('copy', st.copy)
    }
  }

  scheduler = createScheduler({
    frame,
    root: ground,
    reduced: stillNow,
    pressable: el => registry.shapes.get(el)?.pressable ?? false,
  })
  scheduler.wake('mount')

  return {
    wake: reason => scheduler.wake(reason),
    setFrozen(flag) {
      frozen = flag
      applyPause()
    },
    stats,
    dispose() {
      scheduler.dispose()
      sprites?.dispose()
      registry.dispose()
      presenter.dispose()
      probe.dispose()
      dropStage()
      lensMotion.clear()
    },
  }
}
