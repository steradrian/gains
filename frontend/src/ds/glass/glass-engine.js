import { deriveTheme, hexToRgb } from '../../lib/stage-look/color.js'
import { currentPhase, REST_PHASE } from '../../lib/stage-look/clock.js'
import { reducedMotion } from '../../lib/reduced-motion.js'
import { themeOf } from '../../lib/themes.js'
import { KIND, swollen } from './glass-kinds.js'
import { createRegistry } from './glass-registry.js'
import { createScheduler } from './glass-scheduler.js'
import { createWatchdog, glassIsOff } from './glass-watchdog.js'
import { createMaterialProbe } from './material-probe.js'
import { createFixedPresenter } from './presenter-fixed.js'

// Liquid glass engine: the registry, scheduler and presenter wired together for one ground. GlassHost.jsx
// owns its lifetime. Everything here is plain JS so the frame is easy to reason about:
//   read every rect (registry) -> step the springs -> write --lg-press -> draw (presenter).

const CLASSIC_INTENSITY = 0.45 // the design's Classic stage; there is no setting for it
const CLASSIC_EASE_S = 0.1 // time constant of the ease to half on a pushed page (about 400 ms to settle)
const LENS_STRETCH_PX = 10

/**
 * @param {{ ground: Element, host: Element, getInputs: () => { look: string, accent: string, pushed: boolean,
 *   intensity: number, motion: boolean }, onStatus: (s: 'webgl' | 'fallback' | 'reduced') => void,
 *   include?: string, onDom?: () => void }} opts
 *   `include`: the registry only takes shapes inside this selector. `onDom`: called on every DOM change under the ground.
 * @returns {{ wake(reason: string): void, setFrozen(flag: boolean): void, dispose(): void } | null} null when the page keeps the CSS material
 *
 * The page never goes blank: the CSS material stays until the first frame is drawn, and 'webgl' (with the
 * data-lg-on marks that clear the CSS fill) is reported in that same frame. A lost context, a trip of the
 * watchdog or a failed mount reports 'fallback' at once and unmarks every shape.
 */
export function createGlassEngine({ ground, host, getInputs, onStatus, include = '', onDom = () => {} }) {
  if (window.matchMedia?.('(prefers-reduced-transparency: reduce)')?.matches) { onStatus('reduced'); return null }
  if (glassIsOff()) { onStatus('fallback'); return null }
  let scheduler = null
  let registry = null
  let live = false // 'webgl' reported: the shapes are marked and the CSS fill is off
  let frozen = false // the host's pause: a sheet, the search overlay, a hidden document
  let lost = false // the context is gone, or the watchdog tripped
  const applyPause = () => scheduler?.setPaused(frozen || lost)
  const goCss = () => {
    live = false
    registry?.setMarked(false)
    onStatus('fallback')
  }
  const presenter = createFixedPresenter()
  const ok = presenter.mount(host, {
    onLost() { lost = true; applyPause(); goCss() },
    onRestored() { lost = false; applyPause() },
  })
  if (!ok) { onStatus('fallback'); return null }

  const probe = createMaterialProbe(host)
  const watchdog = createWatchdog({
    onTrip() {
      lost = true
      applyPause()
      goCss()
      presenter.dispose()
    },
  })
  registry = createRegistry(ground, {
    include,
    onChange: reason => { scheduler?.wake(reason); if (reason === 'dom') onDom() },
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
    return { ...s, ...swollen(s, p.v, { reduced: stillNow(), stretch, bar: s.bar }), press: p.v, touch: p.touch }
  }

  function frame(dt) {
    const t0 = performance.now()
    const changed = draw(dt)
    watchdog.frame(changed.drew, performance.now() - t0, dt * 1000, t0)
    return changed.any
  }

  function draw(dt) {
    const inp = getInputs()
    const raw = registry.read()
    const moving = scheduler.springs.step(dt)
    const shapes = raw.map(s => compose(s, dt))
    scheduler.springs.flush()
    const { value, easing } = intensityFor(inp, dt)
    const animating = inp.look !== 'plain' && inp.motion && !inp.pushed
    const drew = presenter.draw(shapes, materialFor(inp), {
      look: inp.look,
      theme: themeFor(inp.accent, value),
      phase: animating ? currentPhase() : REST_PHASE,
      calm: !inp.pushed,
    })
    if (drew && !live && !lost) {
      live = true
      registry.setMarked(true)
      onStatus('webgl')
    }
    return { drew, any: moving || easing || drew }
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
    dispose() {
      scheduler.dispose()
      registry.dispose()
      presenter.dispose()
      probe.dispose()
      lensMotion.clear()
    },
  }
}
