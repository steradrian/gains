import { useLayoutEffect, useState } from 'react'
import { trapDialogFocus } from './use-dialog-focus.js'

// What names a sheet: its header, as every sheet builds it (SheetHeader's <h3>, or a hand-written
// <h3>/<h2>/<h1>), the first one in the sheet.
const HEADING = 'h1, h2, h3, [role="heading"]'
const SUB = '[data-sheet-sub]'
const OWN_FOCUS = '[data-own-dialog-focus]'
let titles = 0

// A sheet a person opens (Modals.jsx) as a dialog: `role="dialog"` and `aria-modal`, named by its
// header, with the focus handling of lib/use-dialog-focus.js (moved in on open and kept there, the
// page behind inert, back on the opener when it closes). `el` is the sheet's own element.
//
// A sheet whose content is already a dialog (a photo viewer) keeps its own role and name, and gets
// the focus handling on that element. Only content that carries `data-own-dialog-focus` (the +
// sheet, components/PlusSheet.jsx, which runs the same trap itself) is left entirely alone: two
// traps would fight.
//
// Focus goes to the sheet itself, not to its first control: many sheets open on a text field (the
// food search, a weight) and a phone raises its keyboard for a focused field. A sheet that
// focuses a field of its own on open keeps it.
//
// `present` is the sheet's presence (components/presence.jsx): a sheet that has been closed stays
// on screen while its way out plays, and everything above is handed back the moment it is closed,
// not when it is gone: the page is live again and the focus is back on the opener.
//
// The header's muted line (SheetHeader's `sub`, marked data-sheet-sub) describes the dialog:
// aria-describedby points at it, so a confirm's question is read out with its title. `role` is
// 'alertdialog' for a sheet that interrupts with a question that must be weighed (a destructive
// confirm, a locked one, a choice between keeping and losing work); every other sheet is a dialog.
export function useSheetDialog(ref, present = true, role = 'dialog') {
  // Asked while rendering, before the sheet is in the page: a field inside that focuses itself
  // as it mounts would otherwise be taken for what opened the sheet.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  useLayoutEffect(() => {
    const sheet = ref.current
    if (!present || !sheet || sheet.querySelector(OWN_FOCUS)) return
    // Content that is already a dialog (a photo viewer) keeps its role and name and is the
    // element focus is moved into and trapped in; it only gets the rest of the handling.
    const own = sheet.querySelector('[role="dialog"]')
    const el = own ?? sheet
    let watch = null
    if (!own) {
      el.setAttribute('role', role)
      el.setAttribute('aria-modal', 'true')

      // Named by the header: aria-labelledby points at the heading itself, so a title that changes
      // is the name that changes. A header that arrives after the first paint (a sheet that loads
      // its content) names it when it does. The same for the line that describes it.
      let named = null
      let described = null
      const name = () => {
        if (!described || !el.contains(described)) {
          described = el.querySelector(SUB)
          if (!described) el.removeAttribute('aria-describedby')
          else {
            if (!described.id) described.id = `sheet-sub-${++titles}`
            el.setAttribute('aria-describedby', described.id)
          }
        }
        if (named && el.contains(named)) return
        named = el.querySelector(HEADING)
        if (!named) { el.removeAttribute('aria-labelledby'); return }
        if (!named.id) named.id = `sheet-title-${++titles}`
        el.setAttribute('aria-labelledby', named.id)
      }
      name()
      watch = typeof MutationObserver === 'function' ? new MutationObserver(name) : null
      watch?.observe(el, { childList: true, subtree: true })
    }

    const release = trapDialogFocus(el, { enter: 'dialog', opener })
    return () => {
      watch?.disconnect()
      release()
    }
  }, [present])
}
