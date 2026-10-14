// Per-mode back stacks on top of the one linear history a browser (and the Android WebView) has.
//
// The browser only ever holds the stack of the mode on screen. This module mirrors that stack —
// one path per history position, the position being the router's own `idx` (react-router keeps
// it in history.state; Modals.jsx copies it onto a sheet's entry) — and keeps the other mode's
// stack aside. Switching modes then means: put the leaving mode's entries aside, walk the browser
// back to the first entry, replace it with the bottom of the arriving mode's stack and push the
// rest. Back presses walk down one mode and then leave the app: they cannot reach the other mode.
//
// A replace cannot drop the entries ahead of it, so after a switch the leaving mode's pages can
// still sit in the browser's forward history. `top` is the last live position: a forward step
// past it lands on a dead entry, and the shell steps straight back off it (`deadSteps`).
// Pure: the shell feeds it locations and carries out the plans it returns.
import { MODES, MODE_ROOT, modeOf } from './mode-route.js'

export const emptyNav = mode => ({ entries: [], idx: -1, top: -1, mode: MODES.includes(mode) ? mode : 'train', stacks: {} })

// The mode on screen: the route's own, or for a shared page (/me, /body) the one it sits on.
const modeFor = (nav, path) => modeOf(path) || nav.mode

export function record(nav, { idx, path, navType }) {
  // No position (a history entry nothing wrote one into): count it as the start of a history.
  const at = Number.isInteger(idx) && idx >= 0 ? idx : 0
  const entries = navType === 'PUSH' ? nav.entries.slice(0, at) : nav.entries.slice()
  entries[at] = path
  // A push ends the history here; a pop or a replace leaves what is ahead (forward) as it was.
  // The first location of a document starts the live history wherever it is.
  const top = navType === 'PUSH' || nav.idx < 0 ? at : nav.top
  return { ...nav, mode: modeFor(nav, path), entries, idx: at, top }
}

// A finished switch: what is ahead of here belongs to the mode that was left.
export const settle = nav => ({ ...nav, top: nav.idx, entries: nav.entries.slice(0, nav.idx + 1) })

// How far to step back off a dead forward entry (0 when the position is live).
export const deadSteps = nav => (nav.idx > nav.top ? nav.idx - nav.top : 0)

// The arriving mode's stack: what it held when it was left, else its root. With a `path` (the
// + sheet's Start/Resume going to the workout), that page goes on top unless it is already there.
export function stackFor(nav, target, path) {
  const kept = nav.stacks[target]?.length ? nav.stacks[target] : [MODE_ROOT[target]]
  if (!path || kept[kept.length - 1] === path) return kept
  return [...kept, path]
}

// What switching to `target` takes: how far back to walk (to the first entry), then the paths to
// put there, the first one replacing that entry and the rest pushed. `nav` is what to keep.
// Null when there is nothing to switch: the target is the mode already on screen.
export function planSwitch(nav, target, path) {
  if (!MODES.includes(target) || target === nav.mode) return null
  const leaving = nav.entries.slice(0, nav.idx + 1).filter(Boolean)
  return {
    back: Math.max(0, nav.idx),
    stack: stackFor(nav, target, path),
    nav: { ...nav, mode: target, stacks: { ...nav.stacks, [nav.mode]: leaving } },
  }
}
