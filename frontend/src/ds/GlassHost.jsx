import { useEffect, useRef } from 'react'
import { useColorMode } from '../lib/color-mode.js'
import { useSearch } from '../lib/search/session.js'
import { reducedTransparency, onReducedTransparencyChange } from '../lib/reduced-transparency.js'
import { DEFAULT_INTENSITY } from '../lib/stage-look/index.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import { useStageLook } from '../lib/use-stage-look.js'
import { useUI } from '../store/useUI.js'
import { createGlassEngine } from './glass/glass-engine.js'
import { readPrefs } from './glass/glass-prefs.js'

// Liquid glass host: one per stage ground. It draws every glass shape under the ground into WebGL
// canvases that refract the real stage (the look engine's own shader), and tells the page what to paint
// through <html data-lg>: "gl" (the canvases draw; drawn elements carry data-lg-on), "css" (the frosted
// material: no WebGL, a failure, a page with no stage) or "reduced" (Reduce Transparency). ds.css
// "Liquid glass" is the contract. It starts on "css" and only moves to "gl" with the first drawn frame, so
// a surface is never blank. Nothing runs at rest; scrolling, presses, DOM changes and the look's clock
// wake it, and it freezes under a sheet, the search overlay, a hidden document and a page with no stage.
//
// In the app (App.jsx) it takes no ground: the ground is the body, narrowed to the pages on the shared
// stage, #tabbar and #timer; the look, accent and intensity come from the store. The dev page passes its
// own ground and stage inputs. `onStatus` also reports 'webgl' | 'fallback' | 'reduced' to that caller.
const APP_GROUND = '.g-route[data-shared], #tabbar, #timer'
const STAGE = '.g-route[data-shared] .g-stage'

/**
 * @param {{ groundRef?: { current: Element | null }, look?: string, accent?: string, pushed?: boolean,
 *   intensity?: number, motion?: boolean, onStatus?: (s: 'webgl' | 'fallback' | 'reduced') => void,
 *   cardDpr?: number, shadow?: 'shader' | 'css', stageOnly?: boolean, watchdog?: boolean,
 *   statsRef?: { current: object | null } }} props
 * `pushed`: the page on top is a pushed one (AppStage's half-intensity stage).
 * Liquid glass tuning: the sprite options `cardDpr` and `shadow` default to the stored choice
 * (glass/glass-prefs.js); the dev page passes them, plus `stageOnly`, `watchdog={false}` and `statsRef`
 * (the engine's numbers, for its HUD).
 */
export default function GlassHost({
  groundRef, look, accent, pushed = false, intensity, motion, onStatus,
  cardDpr, shadow, stageOnly = false, watchdog = true, statsRef,
}) {
  const stored = useStageLook()
  const storedAccent = useDsAccent()
  const mode = useColorMode()
  const sheetOpen = useUI(s => s.sheets.length > 0)
  const searchOpen = useSearch(s => s.open)

  const hostRef = useRef(null)
  const engineRef = useRef(null)
  const statusRef = useRef(onStatus)
  const inputsRef = useRef(null)
  // What decides data-lg and the freeze. Plain refs: the page is repainted from here, not by a render.
  const stateRef = useRef({ engine: 'css', reduced: false, noStage: false, sheet: false, search: false, hidden: false })

  inputsRef.current = {
    look: look ?? stored.look,
    accent: accent ?? storedAccent,
    pushed,
    intensity: intensity ?? stored.intensity ?? DEFAULT_INTENSITY,
    motion: motion ?? stored.motion,
    mode,
    stageOnly,
  }

  // Liquid glass tuning: the props win, else the stored choice, read once per mount.
  const prefsRef = useRef(null)
  if (!prefsRef.current) prefsRef.current = readPrefs()
  const prefs = prefsRef.current
  const cardDprIn = cardDpr ?? prefs.cardDpr
  const shadowIn = shadow ?? prefs.shadow

  const sync = () => {
    const s = stateRef.current
    const lg = s.reduced ? 'reduced' : s.engine === 'webgl' && !s.noStage ? 'gl' : 'css'
    if (document.documentElement.dataset.lg !== lg) document.documentElement.dataset.lg = lg
    engineRef.current?.setFrozen(s.reduced || s.noStage || s.sheet || s.search || s.hidden)
  }

  useEffect(() => { statusRef.current = onStatus })

  useEffect(() => {
    stateRef.current.sheet = sheetOpen
    stateRef.current.search = searchOpen
    sync()
  }, [sheetOpen, searchOpen])

  const { look: lookIn, accent: accentIn, intensity: intensityIn, motion: motionIn } = inputsRef.current
  useEffect(() => {
    engineRef.current?.wake('inputs')
  }, [lookIn, accentIn, pushed, intensityIn, motionIn, mode, stageOnly])

  useEffect(() => {
    const state = stateRef.current
    // Liquid glass: the OS query or Appearance › Reduce transparency (html[data-transparency]).
    const onReduced = () => { state.reduced = reducedTransparency(); sync() }
    state.reduced = reducedTransparency()
    const stopReduced = onReducedTransparencyChange(onReduced)

    const onVisible = () => { state.hidden = document.hidden; sync() }
    state.hidden = document.hidden
    document.addEventListener('visibilitychange', onVisible)

    // A page with no stage on it (the stage is display: none there) leaves the chrome on the CSS material.
    let checking = 0
    const checkStage = () => {
      checking = 0
      const none = !document.querySelector(STAGE)
      if (none !== state.noStage) { state.noStage = none; sync() }
    }
    const scheduleStage = () => { if (!checking) checking = requestAnimationFrame(checkStage) }
    state.noStage = !document.querySelector(STAGE)

    const engine = createGlassEngine({
      ground: groundRef ? groundRef.current : document.body,
      include: groundRef ? '' : APP_GROUND,
      host: hostRef.current,
      getInputs: () => inputsRef.current,
      onDom: scheduleStage,
      sprite: { cardDpr: cardDprIn, shadow: shadowIn },
      watchdog,
      onStatus: s => {
        state.engine = s
        if (s === 'reduced') state.reduced = true
        sync()
        statusRef.current?.(s)
      },
    })
    engineRef.current = engine
    if (statsRef) statsRef.current = engine?.stats ?? null
    sync()
    return () => {
      engine?.dispose()
      engineRef.current = null
      if (statsRef) statsRef.current = null
      if (checking) cancelAnimationFrame(checking)
      stopReduced()
      document.removeEventListener('visibilitychange', onVisible)
      state.engine = 'css'
      document.documentElement.dataset.lg = 'css'
    }
  }, [groundRef, cardDprIn, shadowIn, watchdog, statsRef])

  return <div ref={hostRef} className="gl-host" aria-hidden="true" />
}
