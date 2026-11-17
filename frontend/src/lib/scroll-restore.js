// What a route change does to the page's scroll position (App.jsx). Pure, so the table is testable.
//   'top'     a forward navigation, or a fresh load: start at the top, now
//   'keep'    a POP that stays on the route: a sheet's history entry unwinding (Modals.jsx, #63)
//   'restore' back to a page within a tab: where it was left
// A tab switch (lib/use-tab-nav.js) lands on a root, or a page pushed onto it: the top, always.
export function scrollAction({ first, samePath, navType, tabSwitch }) {
  if (first || tabSwitch) return 'top'
  if (navType !== 'POP') return 'top'
  return samePath ? 'keep' : 'restore'
}
