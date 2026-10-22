// The tab on screen's back stack on top of the one linear history a browser (and the Android
// WebView) has.
//
// The browser only ever holds the stack of the tab on screen. This module mirrors that stack — one
// path per history position, the position being the router's own `idx` (react-router keeps it in
// history.state; Modals.jsx gives a sheet's entry the next one). A tab keeps nothing when it is
// left: switching tabs means walking the browser back to the first entry, replacing it with the
// arriving tab's root (plus the page being opened, if any) and pushing the rest. Back presses walk
// down one tab and then leave the app: they never reach another tab's pages.
//
// A replace cannot drop the entries ahead of it, so after a switch the leaving tab's pages can
// still sit in the browser's forward history. `top` is the last live position: a forward step
// past it lands on a dead entry, which the shell steps straight back off (`deadSteps`).
// Pure: the shell feeds it locations and carries out the plans it returns.
import { TABS, TAB_ROOT, isWorkoutPath, tabOf } from './tab-route.js'

export const emptyNav = () => ({ entries: [], idx: -1, top: -1, tab: 'home' })

// The tab on screen: the route's own, or for a shared page (Profile, the workout) the one under it.
const tabFor = (nav, path) => tabOf(path.split('?')[0]) || nav.tab

// Whether the position `i` of the mirror holds another tab's page. Only a search visit puts one on
// a tab's stack (record's `keepTab`); everywhere else a page of another tab is a switch.
const foreignAt = (nav, i) => {
  const p = i >= 0 ? nav.entries[i] : null
  const tab = p && tabOf(pathOnly(p))
  return !!tab && tab !== nav.tab
}

/** Whether the page on screen is another tab's, opened on this tab's stack by a search visit: a
 *  link followed from it, or the page replacing its own address, stays on that visit. */
export const onVisitPage = nav => nav.idx >= 0 && foreignAt(nav, nav.idx)

// `keepTab`: a page the global search opened on top of its overlay (lib/search/session.js). It
// may be another tab's page, and it still sits on this tab's stack: back returns to the overlay.
// So does whatever is opened from such a page, and a step back or forward onto one.
export function record(nav, { idx, path, navType, keepTab = false }) {
  // No position (an entry nothing wrote one into): count it as the start of a history.
  const at = Number.isInteger(idx) && idx >= 0 ? idx : 0
  // Forward onto a page of a tab that was left: not this tab's page, nothing to mirror.
  if (navType === 'POP' && nav.idx >= 0 && at > nav.top) return { ...nav, idx: at }
  const visit = keepTab || (navType === 'POP' ? foreignAt(nav, at) : onVisitPage(nav))
  const entries = navType === 'PUSH' ? nav.entries.slice(0, at) : nav.entries.slice()
  entries[at] = path
  // A push ends the history here; a pop or a replace leaves what is ahead (forward) as it was.
  // The first location of a document starts the live history wherever it is. A replace past the
  // top is the router taking over a sheet's entry (closeThenNav): live, as the page it became.
  const top = navType === 'PUSH' || nav.idx < 0 ? at : navType === 'REPLACE' ? Math.max(nav.top, at) : nav.top
  return { ...nav, tab: visit && nav.idx >= 0 ? nav.tab : tabFor(nav, path), entries, idx: at, top }
}

// A finished switch: what is ahead of here belongs to the tab that was left.
export const settle = nav => ({ ...nav, top: nav.idx, entries: nav.entries.slice(0, nav.idx + 1) })

// How far to step back off a dead forward entry (0 when the position is live).
export const deadSteps = nav => (nav.idx > nav.top ? nav.idx - nav.top : 0)

// The tab's pages as the mirror holds them: no gaps, never the workout (a session that has ended
// there would come back as the Start screen; the dock reopens one that runs), and one entry for a
// page that sat on two positions (a sheet's entry the router then replaced with the same page).
const compact = paths => paths.filter(p => p && !isWorkoutPath(p)).filter((p, i, all) => i === 0 || p !== all[i - 1])

const pathOnly = p => p.split(/[?#]/)[0]

// What showing `target` takes: how far back to walk (to the first entry), then the paths to put
// there, the first one replacing that entry and the rest pushed. `nav` is what to keep.
// - another tab: its root, with `path` on top when a page is being opened in it (the avatar
//   opening Profile, a Profile row opening Routines). Whatever the tab held when it was left is gone;
// - the tab on screen with `toRoot` (its bar button tapped again): back down to its root, or to
//   `path` on its root (the search shortcut on a Progress page: Progress, over Profile).
// Null when there is nothing to do.
export function planSwitch(nav, target, { path, toRoot = false } = {}) {
  if (!TABS.includes(target)) return null
  const root = TAB_ROOT[target]
  const stack = path && path !== root ? [root, path] : [root]
  if (target === nav.tab) {
    if (!toRoot) return null
    const own = p => { const tab = tabOf(pathOnly(p)); return !tab || tab === nav.tab }
    const here = compact(nav.entries.slice(0, nav.idx + 1)).filter(own)
    // The workout is left out of `here`, but a session open on top of the root is still a page to leave.
    if (here.join('\n') === stack.join('\n') && nav.entries.slice(0, nav.idx + 1).every(p => !p || (own(p) && !isWorkoutPath(p)))) return null
    return { back: Math.max(0, nav.idx), stack, nav }
  }
  return { back: Math.max(0, nav.idx), stack, nav: { ...nav, tab: target } }
}
