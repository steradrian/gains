import { createElement } from 'react'
import { useUI } from '../../store/useUI.js'
import ConfirmDrawer from '../../ds/ConfirmDrawer.jsx'

/**
 * Opens the R5 confirm (ds/ConfirmDrawer): `title, body, items, note, icon, confirmLabel,
 * cancelLabel, onConfirm, onCancel`. Through `openSheet`, so from inside a drawer it slides in as
 * a sub-panel instead of stacking a second one. Confirm closes it and runs `onConfirm` once;
 * Cancel, the ×, the scrim, Escape and Back close it and run `onCancel`, if there is one.
 */
export function confirmDrawer({ onConfirm, onCancel, ...rest }) {
  return useUI.getState().openSheet(close => createElement(ConfirmDrawer, {
    ...rest,
    onConfirm: () => { close(); onConfirm?.() },
    onCancel: () => { close(); onCancel?.() },
  }), { variant: 'ds', onDismiss: onCancel })
}
