// The shell's side of lib/route-transition.js: keeps the page being left mounted beside the page
// arriving for as long as the slide lasts, then lets it go.
//
// It answers with the layers to render, `[leaving?, current]`, each `{ key, route, role: 'out' |
// 'in', location, y, style }` (and `fade` on the current one: whether the page fades in on its
// own). The current layer is always last and keeps its React identity across the slide
// (the leaving one is the same element it was a render ago, only its role changes), so neither
// page remounts and nothing flashes. `y` is the scroll offset a layer is drawn at while it is
// lifted out of the document (ds.css .g-route): the page left stays where it was scrolled, the page
// returned to is already where it will land. `style` is 'push' | 'pop' | 'fade' (reduced motion).
//
// Worked out while rendering (state set during render, which React re-runs at once), so the first
// frame already has both pages and the arriving one never paints at rest in its place.
import { useEffect, useState } from 'react'
import { onSheetEntry } from './nav.js'
import { FADE_MS, SLIDE_MS, transitionKind } from './route-transition.js'

// How long after the animation's own end the leaving page is let go if animationend never came
// (a hidden tab, an engine that skipped the animation).
const GRACE_MS = 80

// iOS Safari's edge swipe plays its own page-slide before it fires popstate; sliding again on top
// of it would be two slides. A swipe that began at an edge and moved is remembered for a moment.
const EDGE_PX = 24
const SWIPE_PX = 30
const SWIPE_MEMORY_MS = 1500
let edgeStart = null
let swipedAt = 0
let guardInstalled = false
function installEdgeSwipeGuard() {
  if (guardInstalled || typeof window === 'undefined') return
  guardInstalled = true
  window.addEventListener('touchstart', e => {
    const x = e.touches[0]?.clientX
    edgeStart = x != null && (x <= EDGE_PX || x >= window.innerWidth - EDGE_PX) ? x : null
  }, { passive: true })
  window.addEventListener('touchmove', e => {
    const x = e.touches[0]?.clientX
    if (edgeStart != null && x != null && Math.abs(x - edgeStart) > SWIPE_PX) { swipedAt = Date.now(); edgeStart = null }
  }, { passive: true })
}
const edgeSwiped = () => Date.now() - swipedAt < SWIPE_MEMORY_MS

/**
 * @param {object} p
 * @param {import('react-router-dom').Location} p.location  the page on screen
 * @param {'PUSH' | 'POP' | 'REPLACE'} p.navType
 * @param {string} p.routeKey  the page's identity: the same key is the same page (a query changing)
 * @param {boolean} p.enabled  false for the screens that bring their own entrance (onboarding, sign-in)
 * @param {boolean} p.reduced  reduced motion: cross-fade instead of slide
 * @param {() => number} p.leavingY  the scroll position of the page being left
 * @param {() => number} p.arrivingY  where the page arrived at will land (a pop returns to its scroll)
 */
export function useRouteTransition({ location, navType, routeKey, enabled, reduced, leavingY, arrivingY }) {
  const [st, setSt] = useState(() => ({ key: routeKey, gen: 0, location, enabled, leaving: null, style: 'none', y: 0, fade: true }))
  let state = st
  if (st.key !== routeKey) {
    let kind = 'none'
    if (st.enabled && enabled) {
      kind = transitionKind({ from: st.location, to: location, navType, sheetEntry: onSheetEntry() })
      if (kind === 'pop' && edgeSwiped()) kind = 'none'
    }
    state = {
      key: routeKey, gen: st.gen + 1, location, enabled,
      leaving: kind === 'none' ? null : { key: st.key, gen: st.gen, location: st.location, y: leavingY() },
      style: kind === 'none' ? 'none' : reduced ? 'fade' : kind,
      y: kind === 'pop' ? arrivingY() : 0,
      // Fixed for as long as the page is mounted (a class added later would play the fade then):
      // a page that slides in does not also fade in, any other arrival does.
      fade: kind === 'none',
    }
    setSt(state)
  }

  useEffect(() => { installEdgeSwipeGuard() }, [])

  const settle = () => setSt(s => (s.leaving ? { ...s, leaving: null, style: 'none' } : s))
  const sliding = !!state.leaving
  useEffect(() => {
    if (!sliding) return
    const id = setTimeout(settle, (state.style === 'fade' ? FADE_MS : SLIDE_MS) + GRACE_MS)
    return () => clearTimeout(id)
    // One timer per slide: a new slide changes the leaving key.
  }, [sliding, state.gen])

  const style = sliding ? state.style : 'none'
  // `key` is the React key: a page is mounted afresh by every navigation, even back onto a page
  // that is still leaving (A to B to A within a slide), as it always was. `route` is its address.
  const layers = [
    state.leaving && { key: `${state.leaving.key}#${state.leaving.gen}`, route: state.leaving.key, role: 'out', location: state.leaving.location, y: state.leaving.y, style },
    { key: `${routeKey}#${state.gen}`, route: routeKey, role: 'in', location, y: sliding ? state.y : 0, style, fade: state.fade },
  ].filter(Boolean)
  return { layers, active: sliding, style, settle }
}
