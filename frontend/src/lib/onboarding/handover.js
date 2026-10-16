import { useLayoutEffect } from 'react'
import { flushSync } from 'react-dom'
import { onReducedMotion, reducedMotion } from '../reduced-motion.js'

// The Summary's hand-over into Home (fitness-eval motion-onboarding-summary-v2 §3, §4). Stage A,
// the unwind, runs on the Summary (the ring turns back into a line); stage B is a View Transition
// in which Home mounts and the line, named `thread`, moves onto Home's hero hairline (or, where
// Home's hero has none, the MonthBar's). The names live in CSS under html.vt-handover, so they
// exist only from just before the transition starts until it has finished; which of the two
// hairlines takes the name is decided there, on the DOM Home mounts (tab-kit.css).
//
// kcal-value and water-value are not named: Home reads the diary after it mounts, so on the frame
// the transition captures its hero may still show dashes, not the target (the spec's fallback:
// those parts crossfade with the page).
//
// Home's first visit plays its cascade once (firstHome): the flag is taken by the first Home that
// mounts after the hand-over, and never set by a normal tab visit.

let firstHome = null

/** Home's first visit after the Summary: 'cascade', 'fade' (reduced motion) or null. Taken once. */
export function takeFirstHome() {
  const mode = firstHome
  firstHome = null
  return mode
}

// How long Home's first-visit class stays on: past the cascade's last beat (tab-kit.css).
const CASCADE_MS = 900
const FADE_MS = 160

/**
 * Home's side: on the first Home after the hand-over, its sections come in once (html.home-first,
 * transform and opacity only; html.home-fade under reduced motion, a 120ms fade). Input is never
 * held: the classes only start CSS animations, and they go once those are over.
 */
export function useFirstHome() {
  useLayoutEffect(() => {
    const mode = takeFirstHome()
    if (!mode) return undefined
    const cls = mode === 'fade' ? 'home-fade' : 'home-first'
    const root = document.documentElement
    root.classList.add(cls)
    const id = setTimeout(() => root.classList.remove(cls), mode === 'fade' ? FADE_MS : CASCADE_MS)
    return () => { clearTimeout(id); root.classList.remove(cls) }
  }, [])
}

/**
 * Goes Home from the Summary. `unwind()` is stage A and resolves when it is done; `go()` leaves for
 * Home (synchronously, inside the transition). Without View Transitions the line unwinds and Home
 * comes in with its cascade; under reduced motion there is no unwind and no transition, Home
 * simply fades in, and so it does when that is switched on while the unwind or the transition runs
 * (the transition is skipped, its names cleared).
 */
export async function handOver({ unwind, go }) {
  if (reducedMotion()) {
    firstHome = 'fade'
    go()
    return
  }
  await unwind()
  if (reducedMotion()) {
    firstHome = 'fade'
    go()
    return
  }
  firstHome = 'cascade'
  const root = document.documentElement
  if (typeof document.startViewTransition !== 'function') { go(); return }
  root.classList.add('vt-handover')
  let off = () => {}
  const clear = () => { off(); root.classList.remove('vt-handover') }
  try {
    const vt = document.startViewTransition(() => flushSync(go))
    off = onReducedMotion(() => {
      // Home not mounted yet: it fades in, not cascades. Mounted: its cascade stops where it is.
      if (firstHome) firstHome = 'fade'
      else root.classList.remove('home-first')
      vt.skipTransition?.()
      clear()
    })
    vt.finished.then(clear, clear)
  } catch {
    clear()
    go()
  }
}
