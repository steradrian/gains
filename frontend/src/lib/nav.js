// Lets non-component modules (sheet flows) navigate. App registers the router's navigate.
let _nav = () => {}
export const setNav = fn => { _nav = fn }
// `opts` goes to the router as is ({ replace: true }).
export const nav = (to, opts) => (opts ? _nav(to, opts) : _nav(to))

// Every open sheet sits on a history entry of its own (Modals.jsx), and closing it walks back
// only while the page is still where the sheet opened. A sheet that closes and moves to another
// page at once left that entry behind: back from the new page landed on it, the same page with
// no sheet, and the next back seemed to do nothing. The new page takes the sheet's entry instead.
export const onSheetEntry = () => {
  try { return !!globalThis.history?.state?.gainsSheet } catch { return false }
}

// How many sheet entries Modals.jsx still holds as live — more than the sheets open means one is
// closing right now and its entry is about to be walked off. Fewer (none, after a reload with a
// sheet's entry on top) means an entry nobody will walk off.
let liveSheetEntries = 0
export const noteSheetEntries = n => { liveSheetEntries = n }
export const sheetEntriesLive = () => liveSheetEntries

// The `close` a sheet's render is handed closes that sheet alone; in a drawer's sub-panel that is
// the panel, and a page change must take the whole drawer with it. `close.drawer` is the drawer's
// (the same function for a sheet that is not a panel).
const wholeDrawer = close => close?.drawer || close

// Closes the drawer `close` belongs to and then runs `go(replace)`, which moves to another page:
// `replace` says the new page takes the sheet's history entry (a drawer on one entry). A drawer
// that holds sub-panels holds several, and one replace can only take one of them: they are all
// walked off (Modals.jsx) first and `go(false)` pushes the page.
export function closeThen(close, go) {
  const drawer = wholeDrawer(close)
  if (onSheetEntry() && liveSheetEntries > 1) {
    drawer?.()
    whenSheetGone(() => go(false))
    return
  }
  const replace = onSheetEntry()
  drawer?.()
  go(replace)
}

export const closeThenNav = (close, to) => closeThen(close, replace => nav(to, replace ? { replace: true } : undefined))

// Runs `fn` once the sheet closing in this same handler has had its history entry walked off
// (Modals.jsx does it after the sheet closes, while the address is still the one it opened on).
// Anything that writes the address or removes the page's subject goes through it: written in the
// same commit as the close, it made Modals skip the walk-off and left the entry behind, and a
// replace even overwrote the sheet's entry with the new address. With no live sheet entry to walk
// off, `fn` runs at once; a walk-off that never comes is waited for WALK_OFF_MS at most.
const WALK_OFF_MS = 400
export function whenSheetGone(fn) {
  if (!onSheetEntry() || liveSheetEntries < 1) { fn(); return }
  let done = false
  const go = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    globalThis.removeEventListener('popstate', go)
    fn()
  }
  const timer = setTimeout(go, WALK_OFF_MS)
  globalThis.addEventListener('popstate', go)
}

// A sheet that swaps the page under it (Progress › Body's Add photo from Weight): the page must
// not stay in history, or back lands on the page it replaced. The sheet's entry is walked off
// first, then the page itself is replaced.
export function closeThenReplace(close, to) {
  wholeDrawer(close)()
  whenSheetGone(() => nav(to, { replace: true }))
}

// Into the workout screen: from the routine chooser (already #/train/workout) or from a sheet's
// entry, the session takes that entry, so one back leaves it rather than landing on itself.
export function navToWorkout() {
  const here = String(globalThis.location?.hash || '').startsWith('#/train/workout')
  nav('/train/workout', here || onSheetEntry() ? { replace: true } : undefined)
}
