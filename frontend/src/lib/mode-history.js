// Per-mode back stacks on top of the one linear history a browser (and the Android WebView) has.
//
// The browser only ever holds the stack of the mode on screen. This module mirrors that stack —
// one entry per router location, matched by the router's location key so a POP of any distance
// lands on the right entry — and keeps the other mode's stack aside. Switching modes then means:
// put the leaving mode's entries aside, walk the browser back to the first entry, replace it with
// the bottom of the arriving mode's stack and push the rest. History never holds both modes at
// once, so a run of back presses walks down one mode and then leaves the app: it cannot bounce
// into the other mode. Pure: the shell feeds it locations and carries out the plans it returns.
import { MODES, MODE_ROOT, modeOf } from './mode-route.js'

export const emptyNav = mode => ({ entries: [], idx: -1, mode: MODES.includes(mode) ? mode : 'train', stacks: {} })

// The mode on screen: the route's own, or for a shared page (/me, /body) the one it sits on.
const modeFor = (nav, path) => modeOf(path) || nav.mode

export function record(nav, { key, path, navType }) {
  const entry = { key, path }
  const mode = modeFor(nav, path)
  if (navType === 'PUSH' && nav.idx >= 0) {
    return { ...nav, mode, entries: [...nav.entries.slice(0, nav.idx + 1), entry], idx: nav.idx + 1 }
  }
  if (navType === 'REPLACE' && nav.idx >= 0) {
    const entries = nav.entries.slice()
    entries[nav.idx] = entry
    return { ...nav, mode, entries }
  }
  // A POP: back, forward, or the very first location of a page load. A key we know is an entry we
  // already mirror; anything else is a history we have not seen (a fresh load, or one reloaded
  // after this mirror was lost) and starts the mirror over from here.
  const at = nav.entries.findIndex(e => e.key === key)
  if (at >= 0) {
    const entries = nav.entries.slice()
    entries[at] = entry
    return { ...nav, mode, entries, idx: at }
  }
  // The router reads 'default' for an entry it did not write: a sheet's own entry (Modals.jsx)
  // left behind on the page it opened over. It is still that page, so the mirror stays put.
  if (key === 'default' && nav.idx >= 0) return { ...nav, mode }
  return { ...nav, mode, entries: [entry], idx: 0 }
}

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
  const leaving = nav.entries.slice(0, nav.idx + 1).map(e => e.path)
  return {
    back: Math.max(0, nav.idx),
    stack: stackFor(nav, target, path),
    nav: { ...nav, mode: target, stacks: { ...nav.stacks, [nav.mode]: leaving } },
  }
}
