// While the search is open the page behind it is out of reach (fitness-eval ux-search.md §6): the
// overlay is not a modal dialog, so it is the page that is made inert, not the overlay that traps.
// What stays live is the header (the pill and the avatar's ×) and the overlay with its results;
// what goes is the rest of #app, the tab bar and the live dock or rest timer.
//
// The header is a child of #app (layout.jsx), so #app itself cannot be inert: it is everything
// beside the header's way up to #app that is, level by level. #app's own `inert` is not touched:
// App.jsx holds it while a tab switch walks the history, and a sheet holds #app, #tabbar and
// #timer through use-dialog-focus. An element that is already inert is somebody else's, left
// alone and left held when this lets go; only what this set is lifted.
const BAR = ['tabbar', 'timer']

/** Holds the page still. Returns the release. */
export function holdPage() {
  const doc = globalThis.document
  const mine = new Set()
  const hold = el => {
    if (el.hasAttribute('inert')) return
    el.setAttribute('inert', '')
    mine.add(el)
  }
  for (const id of BAR) {
    const el = doc.getElementById(id)
    if (el) hold(el)
  }

  // Beside the header, up to #app. A sibling added later (a view rendering a block under the
  // header once its data lands) is held by the observer: inert is inherited downward only.
  const way = []
  for (let node = doc.querySelector('#app .tab-hdr'); node && node.id !== 'app' && node.parentElement; node = node.parentElement) way.push(node)
  const holdBeside = () => {
    for (const node of way) for (const sibling of node.parentElement.children) if (sibling !== node) hold(sibling)
  }
  holdBeside()
  const watch = new MutationObserver(holdBeside)
  for (const node of way) watch.observe(node.parentElement, { childList: true })

  return () => {
    watch.disconnect()
    mine.forEach(el => el.removeAttribute('inert'))
  }
}
