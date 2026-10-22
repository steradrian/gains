import { useEffect, useRef } from 'react'
import { DEFAULT_INTENSITY } from '../lib/stage-look/index.js'
import { createGlassEngine } from './glass/glass-engine.js'

// Liquid glass host: one per stage ground. It draws every glass shape under `groundRef` into WebGL
// canvases that refract the real stage (the look engine's own shader), and reports what the page should
// paint through `onStatus`: 'webgl', 'fallback' (no usable WebGL, or the context was lost) or 'reduced'
// (Reduce Transparency). Nothing runs at rest; scrolling, pointer presses, DOM changes and the look's
// clock wake it. The app's inputs (store look, accent, pushed page) come in M2; for now the caller
// passes them.
/**
 * @param {{ groundRef: { current: Element | null }, look: string, accent: string, pushed?: boolean,
 *   intensity?: number, motion?: boolean, onStatus?: (s: 'webgl' | 'fallback' | 'reduced') => void }} props
 * `look`, `accent`, `pushed`, `intensity` and `motion` are what AppStage gives StageLook.
 */
export default function GlassHost({ groundRef, look, accent, pushed = false, intensity = DEFAULT_INTENSITY, motion = true, onStatus }) {
  const hostRef = useRef(null)
  const inputsRef = useRef({ look, accent, pushed, intensity, motion })
  const engineRef = useRef(null)
  const statusRef = useRef(onStatus)

  useEffect(() => { statusRef.current = onStatus })

  useEffect(() => {
    inputsRef.current = { look, accent, pushed, intensity, motion }
    engineRef.current?.wake('inputs')
  }, [look, accent, pushed, intensity, motion])

  useEffect(() => {
    const engine = createGlassEngine({
      ground: groundRef.current,
      host: hostRef.current,
      getInputs: () => inputsRef.current,
      onStatus: s => statusRef.current?.(s),
    })
    engineRef.current = engine
    return () => {
      engine?.dispose()
      engineRef.current = null
    }
  }, [groundRef])

  return <div ref={hostRef} className="gl-host" aria-hidden="true" />
}
