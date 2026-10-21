// Which way a page change moves, worked out from the navigation alone (no history length, no
// guessing from the DOM). Pure, so the table is testable; lib/use-route-transition.js carries it out
// and ds.css "Native motion and haptics" draws it.
//
//   'push'  a page pushed on top: the new one slides in from the end side, the old one drifts back
//   'pop'   the same, reversed: Back, the browser's or Android's back, any POP that goes shallower
//   'none'  everything else: a tab switch (the roots do not slide), a replace or redirect, the
//           sheet a drawer pushes into history (Modals.jsx) and the pathname-less changes of a
//           query or fragment, and the very first page
import { routeDepth, tabOf } from './tab-route.js'

export const SLIDE_MS = 300
// Reduced motion: no transform at all, the two pages cross-fade.
export const FADE_MS = 150

/**
 * @param {{ pathname: string, state?: any } | null} from  the page on screen
 * @param {{ pathname: string, state?: any }} to  the page arriving
 * @param {'PUSH' | 'POP' | 'REPLACE'} navType  react-router's useNavigationType() for `to`
 * @param {boolean} sheetEntry  history.state is a drawer's entry (lib/nav.js onSheetEntry)
 * @returns {'push' | 'pop' | 'none'}
 */
export function transitionKind({ from, to, navType, sheetEntry = false }) {
  if (!from || !to) return 'none'
  // A drawer opening or closing walks the history but leaves the page where it is; a query or a
  // fragment changing is the same page too.
  if (from.pathname === to.pathname || sheetEntry) return 'none'
  if (navType === 'REPLACE') return 'none'
  // Landing on another tab's page is a tab switch (lib/use-tab-nav.js flags the entries it builds),
  // whichever way the history was walked to get there. The workout belongs to no tab.
  if (to.state?.tabSwitch && navType !== 'POP') return 'none'
  const a = tabOf(from.pathname)
  const b = tabOf(to.pathname)
  if (a && b && a !== b) return 'none'
  if (navType === 'PUSH') return 'push'
  // A POP is Back unless it goes deeper (the browser's forward button).
  return routeDepth(to.pathname) > routeDepth(from.pathname) ? 'push' : 'pop'
}
